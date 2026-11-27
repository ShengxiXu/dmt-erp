package com.dmt.erp.sys.vo;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
public class MenuTreeVo implements Serializable {
    private Long id;
    private Long parentId;
    private String name;
    private String permCode;
    private String type;
    private String path;
    private Integer sort;
    private List<MenuTreeVo> children;
}
