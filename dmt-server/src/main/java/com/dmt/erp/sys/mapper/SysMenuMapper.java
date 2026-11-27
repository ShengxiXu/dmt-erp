package com.dmt.erp.sys.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dmt.erp.sys.entity.SysMenu;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysMenuMapper extends BaseMapper<SysMenu> {

    @Select("SELECT DISTINCT m.* FROM sys_menu m "
            + "JOIN sys_role_menu rm ON rm.menu_id = m.id AND rm.deleted = 0 "
            + "JOIN sys_user_role ur ON ur.role_id = rm.role_id AND ur.deleted = 0 "
            + "WHERE ur.user_id = #{userId} AND m.deleted = 0 ORDER BY m.sort")
    List<SysMenu> selectByUserId(@Param("userId") Long userId);
}
