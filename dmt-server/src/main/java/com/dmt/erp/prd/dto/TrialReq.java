package com.dmt.erp.prd.dto;

import lombok.Data;

import java.util.Map;

/** 试算请求：传 itemKey 用已存条目的规则；或传 calcMethod+calcParams 试未保存的规则（表单内试算） */
@Data
public class TrialReq {
    private String itemKey;
    private String calcMethod;
    private Map<String, Object> calcParams;
    private Map<String, Object> inputs;
}
