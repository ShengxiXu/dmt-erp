package com.dmt.erp.mdm.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class EntitySaveReq {
    private Long id;
    private String shortName;
    private String fullName;
    private String nature;
    private String taxNo;
    private String bank;
    private String account;
    private String status;
    @Valid
    private List<SealReq> seals;

    @Data
    public static class SealReq {
        private String name;
        private String type;
        private String sealNo;
    }
}
