package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

/** 资源目录（物料库）：资源的通用定义（类），属性模板驱动资源中心档案表单 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prd_material")
public class PrdMaterial extends BaseEntity {
    private String matKey;
    private String name;
    private String form;
    private String groupName;
    private String archiveKey;
    private String status;
    private String remark;
    private String attrsJson;
    private String purchaseKind;
    private String purchaseUnit;

    /** 派生：被产品类型引用数（prd_type_material distinct type） */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private Long refCount;
}
