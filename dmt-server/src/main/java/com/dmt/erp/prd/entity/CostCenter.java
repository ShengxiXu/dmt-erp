package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("cost_center")
public class CostCenter extends BaseEntity {
    private String code;
    private String name;
    private String settleType;
    private String settleRule;
    private String driverKey;
    private String formula;
    private String status;

    /** 派生：归集到本中心的成本条目数 / 名称（cost_item.cost_center 反查） */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private Long itemCount;
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private String itemNames;
    /** 归集条目 key 列表（表单中心侧维护；保存时回写 cost_item.cost_center） */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private java.util.List<String> itemKeys;
    /** 派生：当月归集（最新账期已入账供应商账单合计）与账期 */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private java.math.BigDecimal monthTotal;
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private String monthPeriod;
    /** 派生：在用产品（资源清单勾选了本中心的产品类型） */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private Long usedByCount;
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private String usedByNames;
}
