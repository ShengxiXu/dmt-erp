package com.dmt.erp.cost.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.PrdPriceDict;
import com.dmt.erp.prd.entity.ResEquipment;
import com.dmt.erp.prd.entity.ResExitPool;
import com.dmt.erp.prd.mapper.PrdPriceDictMapper;
import com.dmt.erp.prd.mapper.ResEquipmentMapper;
import com.dmt.erp.prd.mapper.ResExitPoolMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 成本计算引擎：成本条目的「计算方式」唯一实现处。
 * 条目表单试算、核算单填报算钱走同一入口，口径见《出口带宽成本计价口径设计 v1.1》与《成本核算模块设计说明》。
 */
@Service
@RequiredArgsConstructor
public class CostCalcService {

    private final ResExitPoolMapper poolMapper;
    private final PrdPriceDictMapper priceDictMapper;
    private final ResEquipmentMapper equipmentMapper;

    /** 系统实现的计算方式（key → 中文名），条目表单的选项出处 */
    public static final Map<String, String> METHOD_LABELS = new LinkedHashMap<>() {{
        put("QTY_PRICE", "按量计价");
        put("POOL_SHARE", "池化分摊");
        put("BGP_UTIL", "目标利用率");
        put("MANDAY", "工时计价");
        put("PER_OBJECT", "按对象分摊");
        put("RESALE", "直接结转");
        put("FIXED", "固定金额");
        put("MANUAL", "手工填列");
    }};

    public record CalcResult(BigDecimal amount, String calcText) {
    }

    public String methodLabel(String method) {
        return METHOD_LABELS.getOrDefault(method, method);
    }

    // ---------- 保存时校验 ----------

    public void validate(String method, Map<String, Object> params) {
        if (!METHOD_LABELS.containsKey(method)) {
            throw new BizException(ResultCode.PARAM_INVALID, "未知计算方式：" + method);
        }
        Map<String, Object> p = params == null ? Map.of() : params;
        switch (method) {
            case "QTY_PRICE" -> {
                String source = str(p, "priceSource", "manual");
                if (!source.equals("equipment") && !source.equals("param") && !source.equals("manual")) {
                    throw new BizException(ResultCode.PARAM_INVALID, "单价来源必须是 equipment / param / manual");
                }
                if (source.equals("param") && dec(p, "unitPrice") == null) {
                    throw new BizException(ResultCode.PARAM_INVALID, "固定单价来源必须填写单价");
                }
            }
            case "POOL_SHARE" -> {
                if (StringUtils.hasText(str(p, "poolCode"))) {
                    mustPool(str(p, "poolCode"));
                }
            }
            case "BGP_UTIL" -> {
                if (StringUtils.hasText(str(p, "poolCode"))) {
                    mustPool(str(p, "poolCode"));
                }
                BigDecimal util = dec(p, "targetUtil");
                if (util != null && (util.compareTo(BigDecimal.ZERO) <= 0 || util.compareTo(BigDecimal.ONE) > 0)) {
                    throw new BizException(ResultCode.PARAM_INVALID, "目标利用率必须在 0~1 之间（如 0.8）");
                }
            }
            case "MANDAY" -> {
                String role = str(p, "rateRole");
                if (!StringUtils.hasText(role)) {
                    throw new BizException(ResultCode.PARAM_INVALID, "工时计价必须选择费率岗位（计价标准）");
                }
                mustRate(role);
            }
            case "PER_OBJECT" -> {
                BigDecimal cnt = dec(p, "objectCount");
                if (cnt != null && cnt.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BizException(ResultCode.PARAM_INVALID, "服务对象数必须大于 0");
                }
            }
            case "FIXED" -> {
                if (dec(p, "amount") == null) {
                    throw new BizException(ResultCode.PARAM_INVALID, "固定金额方式必须填写金额");
                }
            }
            default -> {
            }
        }
    }

    // ---------- 算式文案（保存时派生，展示用；与 calc 同口径） ----------

    public String formulaText(String method, Map<String, Object> params) {
        Map<String, Object> p = params == null ? Map.of() : params;
        return switch (method) {
            case "QTY_PRICE" -> switch (str(p, "priceSource", "manual")) {
                case "equipment" -> "数量 × 设备档案采购价";
                case "param" -> "数量 × 单价 " + fmt(dec(p, "unitPrice")) + " 元";
                default -> "数量 × 单价（填报时录入）";
            };
            case "POOL_SHARE" -> StringUtils.hasText(str(p, "poolCode"))
                    ? "本单带宽 ÷（池已售 ＋ 本单带宽）× 池月成本（" + str(p, "poolCode") + "）"
                    : "本单带宽 ÷（池已售 ＋ 本单带宽）× 池月成本（核算时选池）";
            case "BGP_UTIL" -> "本单带宽 × 组月成本 ÷ 规划容量 ÷ 目标利用率 " + utilText(p)
                    + (StringUtils.hasText(str(p, "poolCode")) ? "（" + str(p, "poolCode") + "）" : "");
            case "MANDAY" -> "人天 × 费率（" + str(p, "rateRole") + "，计价标准）";
            case "PER_OBJECT" -> "池月金额 ÷ 服务对象数";
            case "RESALE" -> "采购数量 × 采购价（直接结转，不加成）";
            case "FIXED" -> "固定金额 " + fmt(dec(p, "amount")) + " 元";
            case "MANUAL" -> "手工填列（核算单填报时录入金额）";
            default -> "";
        };
    }

    // ---------- 统一计算入口（试算 / 核算单填报共用） ----------

    public CalcResult calc(String method, Map<String, Object> params, Map<String, Object> inputs) {
        Map<String, Object> merged = new LinkedHashMap<>(params == null ? Map.of() : params);
        if (inputs != null) {
            inputs.forEach((k, v) -> {
                if (v != null && StringUtils.hasText(String.valueOf(v))) {
                    merged.put(k, v);
                }
            });
        }
        Map<String, Object> m = merged;
        return switch (method) {
            case "QTY_PRICE" -> calcQtyPrice(m);
            case "POOL_SHARE" -> calcPoolShare(m);
            case "BGP_UTIL" -> calcBgpUtil(m);
            case "MANDAY" -> calcManday(m);
            case "PER_OBJECT" -> calcPerObject(m);
            case "RESALE" -> calcResale(m);
            case "FIXED" -> {
                BigDecimal amount = dec(m, "amount");
                yield new CalcResult(amount, "固定金额 " + fmt(amount) + " 元");
            }
            case "MANUAL" -> new CalcResult(null, "手工填列：核算单填报时录入金额");
            default -> throw new BizException(ResultCode.PARAM_INVALID, "未知计算方式：" + method);
        };
    }

    /** 数量 × 单价：单价来源 = 设备档案 / 条目固定单价 / 填报录入 */
    private CalcResult calcQtyPrice(Map<String, Object> m) {
        BigDecimal qty = requireDec(m, "qty", "数量");
        String qtyLabel = str(m, "qtyLabel", "");
        String source = str(m, "priceSource", "manual");
        BigDecimal price;
        String priceNote;
        switch (source) {
            case "equipment" -> {
                String equipmentId = str(m, "equipmentId");
                if (!StringUtils.hasText(equipmentId)) {
                    throw new BizException(ResultCode.PARAM_INVALID, "按设备档案计价需要选择设备");
                }
                ResEquipment eq = equipmentMapper.selectById(Long.parseLong(equipmentId));
                if (eq == null || eq.getCostPrice() == null) {
                    throw new BizException(ResultCode.STATE_CONFLICT, "设备档案不存在或未维护采购价：" + equipmentId);
                }
                price = eq.getCostPrice();
                priceNote = "（" + eq.getName() + " 档案采购价）";
            }
            case "param" -> {
                price = dec(m, "unitPrice");
                if (price == null) {
                    throw new BizException(ResultCode.PARAM_INVALID, "条目未配置固定单价");
                }
                priceNote = "";
            }
            default -> {
                price = dec(m, "unitPrice");
                if (price == null) {
                    throw new BizException(ResultCode.PARAM_INVALID, "请录入单价");
                }
                priceNote = "（填报单价）";
            }
        }
        BigDecimal amount = qty.multiply(price).setScale(2, RoundingMode.HALF_UP);
        return new CalcResult(amount, fmt(qty) + qtyLabel + " × " + fmt(price) + " 元" + priceNote + " = " + fmt(amount) + " 元");
    }

    /** 出口池化分摊（两步法特例，口径 v1.1）：本单带宽 ÷（池已售 ＋ 本单带宽）× 池月成本 */
    private CalcResult calcPoolShare(Map<String, Object> m) {
        BigDecimal bw = requireDec(m, "qty", "本单带宽");
        ResExitPool pool = mustPool(requireStr(m, "poolCode", "出口池"));
        BigDecimal rent = pool.getRentMonth() == null ? BigDecimal.ZERO : pool.getRentMonth();
        BigDecimal sold = BigDecimal.valueOf(pool.getUsedM() == null ? 0 : pool.getUsedM());
        BigDecimal denom = sold.add(bw);
        BigDecimal amount = denom.compareTo(BigDecimal.ZERO) <= 0 ? BigDecimal.ZERO
                : rent.divide(denom, 6, RoundingMode.HALF_UP).multiply(bw).setScale(2, RoundingMode.HALF_UP);
        String text = fmt(bw) + "M ÷（" + fmt(sold) + "M ＋ " + fmt(bw) + "M）× " + fmt(rent) + " 元"
                + " = " + fmt(amount) + " 元/月（" + pool.getCode() + " " + pool.getName()
                + "：月租 " + fmt(rent) + " 元，已售 " + fmt(sold) + "M）";
        return new CalcResult(amount, text);
    }

    /** BGP 出口组目标利用率（设计说明 §6.2 ②）：本单带宽 × 组月成本 ÷ 规划容量 ÷ 目标利用率 */
    private CalcResult calcBgpUtil(Map<String, Object> m) {
        BigDecimal bw = requireDec(m, "qty", "本单带宽");
        ResExitPool pool = mustPool(requireStr(m, "poolCode", "出口组"));
        BigDecimal util = dec(m, "targetUtil");
        if (util == null) {
            util = new BigDecimal("0.8");
        }
        if (util.compareTo(BigDecimal.ZERO) <= 0 || util.compareTo(BigDecimal.ONE) > 0) {
            throw new BizException(ResultCode.PARAM_INVALID, "目标利用率必须在 0~1 之间");
        }
        BigDecimal rent = pool.getRentMonth() == null ? BigDecimal.ZERO : pool.getRentMonth();
        BigDecimal capacity = BigDecimal.valueOf(pool.getCapacityM() == null ? 0 : pool.getCapacityM());
        if (capacity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BizException(ResultCode.STATE_CONFLICT, "出口组未维护规划容量：" + pool.getCode());
        }
        BigDecimal amount = bw.multiply(rent).divide(capacity, 6, RoundingMode.HALF_UP)
                .divide(util, 2, RoundingMode.HALF_UP);
        String text = fmt(bw) + "M × " + fmt(rent) + " 元 ÷ " + fmt(capacity) + "M ÷ " + util.stripTrailingZeros().toPlainString()
                + " = " + fmt(amount) + " 元/月（" + pool.getCode() + " " + pool.getName() + "，规划容量 " + fmt(capacity) + "M）";
        return new CalcResult(amount, text);
    }

    /** 工时计价：人天 × 费率（费率取计价标准 prd_price_dict） */
    private CalcResult calcManday(Map<String, Object> m) {
        BigDecimal days = requireDec(m, "qty", "人天");
        String role = requireStr(m, "rateRole", "费率岗位");
        PrdPriceDict rate = mustRate(role);
        BigDecimal amount = days.multiply(rate.getRate()).setScale(2, RoundingMode.HALF_UP);
        return new CalcResult(amount, fmt(days) + " 人天 × " + fmt(rate.getRate()) + " 元/人天（" + role + "·计价标准）= " + fmt(amount) + " 元");
    }

    /** 按对象分摊：池月金额 ÷ 服务对象数 */
    private CalcResult calcPerObject(Map<String, Object> m) {
        BigDecimal monthly = requireDec(m, "monthlyAmount", "池月金额");
        BigDecimal count = requireDec(m, "objectCount", "服务对象数");
        if (count.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BizException(ResultCode.PARAM_INVALID, "服务对象数必须大于 0");
        }
        BigDecimal amount = monthly.divide(count, 2, RoundingMode.HALF_UP);
        return new CalcResult(amount, fmt(monthly) + " 元 ÷ " + fmt(count) + " 对象 = " + fmt(amount) + " 元/月·对象");
    }

    /** 直接结转（转售）：采购数量 × 采购价，不加成 */
    private CalcResult calcResale(Map<String, Object> m) {
        BigDecimal qty = requireDec(m, "qty", "采购数量");
        BigDecimal price = requireDec(m, "unitPrice", "采购价");
        BigDecimal amount = qty.multiply(price).setScale(2, RoundingMode.HALF_UP);
        return new CalcResult(amount, fmt(qty) + " × " + fmt(price) + " 元（采购价）= " + fmt(amount) + " 元（直接结转，不加成）");
    }

    // ---------- 数据取用 ----------

    private ResExitPool mustPool(String code) {
        ResExitPool pool = poolMapper.selectOne(new LambdaQueryWrapper<ResExitPool>()
                .eq(ResExitPool::getCode, code).last("LIMIT 1"));
        if (pool == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "出口池/组不存在：" + code);
        }
        return pool;
    }

    private PrdPriceDict mustRate(String role) {
        PrdPriceDict rate = priceDictMapper.selectOne(new LambdaQueryWrapper<PrdPriceDict>()
                .eq(PrdPriceDict::getDictKey, "engineer_rate")
                .eq(PrdPriceDict::getRole, role)
                .eq(PrdPriceDict::getStatus, "启用")
                .orderByDesc(PrdPriceDict::getEffectAt)
                .last("LIMIT 1"));
        if (rate == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "计价标准中未找到启用状态的费率：" + role);
        }
        return rate;
    }

    // ---------- 取值与格式化 ----------

    private String utilText(Map<String, Object> p) {
        BigDecimal util = dec(p, "targetUtil");
        return (util == null ? new BigDecimal("0.8") : util).stripTrailingZeros().toPlainString();
    }

    private String str(Map<String, Object> m, String key) {
        return str(m, key, null);
    }

    private String str(Map<String, Object> m, String key, String def) {
        Object v = m.get(key);
        if (v == null || !StringUtils.hasText(String.valueOf(v))) {
            return def;
        }
        return String.valueOf(v);
    }

    private String requireStr(Map<String, Object> m, String key, String label) {
        String v = str(m, key);
        if (!StringUtils.hasText(v)) {
            throw new BizException(ResultCode.PARAM_INVALID, "缺少" + label);
        }
        return v;
    }

    private BigDecimal dec(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null || !StringUtils.hasText(String.valueOf(v))) {
            return null;
        }
        try {
            return new BigDecimal(String.valueOf(v));
        } catch (NumberFormatException e) {
            throw new BizException(ResultCode.PARAM_INVALID, "数值格式不正确：" + key + "=" + v);
        }
    }

    private BigDecimal requireDec(Map<String, Object> m, String key, String label) {
        BigDecimal v = dec(m, key);
        if (v == null) {
            throw new BizException(ResultCode.PARAM_INVALID, "缺少" + label);
        }
        return v;
    }

    private String fmt(BigDecimal v) {
        if (v == null) {
            return "—";
        }
        return new DecimalFormat("#,##0.##").format(v.stripTrailingZeros());
    }
}
