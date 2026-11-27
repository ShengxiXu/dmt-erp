package com.dmt.erp.prd.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.CostCenter;
import com.dmt.erp.prd.entity.CostItem;
import com.dmt.erp.prd.entity.PrdProductType;
import com.dmt.erp.prd.mapper.CostCenterMapper;
import com.dmt.erp.prd.mapper.CostItemMapper;
import com.dmt.erp.prd.mapper.PrdProductTypeMapper;
import com.dmt.erp.pur.entity.PurBill;
import com.dmt.erp.pur.mapper.PurBillMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CostCenterService {

    private final CostCenterMapper costCenterMapper;
    private final CostItemMapper costItemMapper;
    private final PrdProductTypeMapper productTypeMapper;
    private final PurBillMapper purBillMapper;

    public List<CostCenter> list() {
        List<CostCenter> centers = costCenterMapper.selectList(new LambdaQueryWrapper<CostCenter>().orderByAsc(CostCenter::getId));
        List<CostItem> items = costItemMapper.selectList(new LambdaQueryWrapper<CostItem>()
                .isNotNull(CostItem::getCostCenter));
        List<PrdProductType> types = productTypeMapper.selectList(new LambdaQueryWrapper<PrdProductType>()
                .isNotNull(PrdProductType::getCentersJson));
        // 当月归集口径：最新账单账期、已入账的供应商账单按 条目→中心 归集
        String latestPeriod = purBillMapper.selectObjs(new LambdaQueryWrapper<PurBill>()
                        .select(PurBill::getPeriod).orderByDesc(PurBill::getPeriod).last("LIMIT 1"))
                .stream().findFirst().map(String::valueOf).orElse(null);
        List<PurBill> bills = latestPeriod == null ? List.of()
                : purBillMapper.selectList(new LambdaQueryWrapper<PurBill>()
                        .eq(PurBill::getPeriod, latestPeriod).eq(PurBill::getStatus, "已入账"));
        for (CostCenter c : centers) {
            List<CostItem> mine = items.stream().filter(i -> c.getCode().equals(i.getCostCenter())).toList();
            c.setItemCount((long) mine.size());
            c.setItemNames(mine.stream().map(CostItem::getName).reduce((a, b) -> a + "、" + b).orElse(""));
            c.setItemKeys(mine.stream().map(CostItem::getItemKey).toList());
            List<Long> itemIds = mine.stream().map(CostItem::getId).toList();
            BigDecimal total = bills.stream()
                    .filter(b -> b.getCostItemId() != null && itemIds.contains(b.getCostItemId()))
                    .map(PurBill::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            c.setMonthTotal(total);
            c.setMonthPeriod(latestPeriod);
            List<String> usedBy = types.stream()
                    .filter(t -> t.getCentersJson() != null && t.getCentersJson().contains("\"" + c.getCode() + "\""))
                    .map(PrdProductType::getName).toList();
            c.setUsedByCount((long) usedBy.size());
            c.setUsedByNames(String.join("、", usedBy));
        }
        return centers;
    }

    @Transactional
    public Long create(CostCenter center) {
        if (!StringUtils.hasText(center.getCode())) {
            // 编码自动生成：按物理最大 id 续号（逻辑删除行仍占唯一键）
            center.setCode("CC-" + String.format("%02d", costCenterMapper.nextCenterSeq()));
        }
        if (!StringUtils.hasText(center.getStatus())) {
            center.setStatus("启用");
        }
        try {
            costCenterMapper.insert(center);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "成本中心编码已存在");
        }
        rebindItems(center);
        return center.getId();
    }

    @Transactional
    public void update(CostCenter center) {
        CostCenter exist = costCenterMapper.selectById(center.getId());
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "成本中心不存在");
        }
        try {
            costCenterMapper.updateById(center);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "成本中心编码已存在");
        }
        rebindItems(center);
    }

    /** 中心侧维护归集条目：勾选的条目 cost_center 指向本中心；本中心原有但未被勾选的解除归集（一笔间接费用只归集一个中心） */
    private void rebindItems(CostCenter center) {
        if (center.getItemKeys() == null) {
            return;
        }
        List<CostItem> all = costItemMapper.selectList(new LambdaQueryWrapper<CostItem>()
                .isNotNull(CostItem::getCostCenter));
        for (CostItem it : all) {
            boolean want = center.getItemKeys().contains(it.getItemKey());
            boolean has = center.getCode().equals(it.getCostCenter());
            if (want && !has) {
                it.setCostCenter(center.getCode());
                costItemMapper.updateById(it);
            } else if (!want && has) {
                it.setCostCenter(null);
                costItemMapper.updateById(it);
            }
        }
        // 勾选了他中心未归集的条目：直接改挂本中心（单中心约束由 cost_item.cost_center 单列保证）
        for (String key : center.getItemKeys()) {
            CostItem it = costItemMapper.selectOne(new LambdaQueryWrapper<CostItem>()
                    .eq(CostItem::getItemKey, key).last("LIMIT 1"));
            if (it != null && !center.getCode().equals(it.getCostCenter())) {
                it.setCostCenter(center.getCode());
                costItemMapper.updateById(it);
            }
        }
    }
}
