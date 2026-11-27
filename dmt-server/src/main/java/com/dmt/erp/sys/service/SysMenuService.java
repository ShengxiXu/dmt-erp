package com.dmt.erp.sys.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.sys.entity.SysMenu;
import com.dmt.erp.sys.mapper.SysMenuMapper;
import com.dmt.erp.sys.vo.MenuTreeVo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SysMenuService {

    private final SysMenuMapper menuMapper;

    public List<MenuTreeVo> tree() {
        List<SysMenu> all = menuMapper.selectList(new LambdaQueryWrapper<SysMenu>()
                .orderByAsc(SysMenu::getSort));
        Map<Long, MenuTreeVo> nodeMap = new LinkedHashMap<>();
        for (SysMenu m : all) {
            nodeMap.put(m.getId(), toVo(m));
        }
        List<MenuTreeVo> roots = new ArrayList<>();
        for (MenuTreeVo node : nodeMap.values()) {
            if (node.getParentId() != null && nodeMap.containsKey(node.getParentId())) {
                nodeMap.get(node.getParentId()).getChildren().add(node);
            } else {
                roots.add(node);
            }
        }
        return roots;
    }

    private MenuTreeVo toVo(SysMenu m) {
        MenuTreeVo vo = new MenuTreeVo();
        vo.setId(m.getId());
        vo.setParentId(m.getParentId());
        vo.setName(m.getName());
        vo.setPermCode(m.getPermCode());
        vo.setType(m.getType());
        vo.setPath(m.getPath());
        vo.setSort(m.getSort());
        vo.setChildren(new ArrayList<>());
        return vo;
    }

    public List<String> permsOfUser(Long userId) {
        return menuMapper.selectByUserId(userId).stream()
                .map(SysMenu::getPermCode).filter(Objects::nonNull).distinct().toList();
    }
}
