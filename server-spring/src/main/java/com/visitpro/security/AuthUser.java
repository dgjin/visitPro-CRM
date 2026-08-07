package com.visitpro.security;

/** 鉴权上下文：JWT 载荷 + 数据库实时复核后的角色/部门（所有 id 均为 varchar(64)） */
public record AuthUser(String uid, String role, String deptId) {
    public boolean isAdmin() {
        return "管理员".equals(role);
    }
}
