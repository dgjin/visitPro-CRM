package com.visitpro.service;

import com.visitpro.security.AuthUser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 数据权限：非管理员可见范围 = 本人 + 所在部门子树内成员。
 * 返回 null 表示不限制（管理员）。
 */
@Service
public class DataScopeService {
    private final JdbcTemplate jdbc;

    public DataScopeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<String> getVisibleUserIds(AuthUser user) {
        if (user.isAdmin()) return null;
        Set<String> ids = new LinkedHashSet<>();
        ids.add(user.uid());
        if (user.deptId() != null) {
            List<Map<String, Object>> allDepts = jdbc.queryForList("SELECT id, parentId FROM departments");
            Map<String, List<String>> childrenOf = new HashMap<>();
            for (Map<String, Object> d : allDepts) {
                String id = String.valueOf(d.get("id"));
                String parentId = d.get("parentId") == null ? null : d.get("parentId").toString();
                childrenOf.computeIfAbsent(parentId, k -> new ArrayList<>()).add(id);
            }
            List<String> subtree = new ArrayList<>();
            subtree.add(user.deptId());
            for (int i = 0; i < subtree.size(); i++) {
                List<String> children = childrenOf.get(subtree.get(i));
                if (children != null) subtree.addAll(children);
            }
            if (!subtree.isEmpty()) {
                String placeholders = String.join(",", subtree.stream().map(x -> "?").toList());
                List<String> deptUsers = jdbc.queryForList(
                        "SELECT id FROM users WHERE departmentId IN (" + placeholders + ")",
                        String.class, subtree.toArray());
                ids.addAll(deptUsers);
            }
        }
        return new ArrayList<>(ids);
    }
}
