package com.visitpro.web;

import com.visitpro.security.AuthFilter;
import com.visitpro.security.AuthUser;
import com.visitpro.service.DataScopeService;
import com.visitpro.service.TableMeta;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 通用 CRUD 路由：列表查询 / 拜访详情 / Upsert / 删除（均经 AuthFilter 鉴权 + 数据权限 + 引用保护）。
 * 注意：具体路径（/api/health、/api/auth/*、/api/ollama/*、/api/ai/*）比 /api/{table} 更具体，
 * Spring 按最具体模式优先匹配，等价于 Node 版「通用路由最后挂载」。
 * 所有表主键均为 varchar(64) 字符串。
 */
@RestController
public class CrudController {
    private static final Logger log = LoggerFactory.getLogger(CrudController.class);

    /** 非管理员仅可修改本人信息（且不含敏感字段） */
    private static final List<String> SELF_UPDATE_COLS = List.of("name", "avatarUrl", "customFields", "theme_preference");

    private final JdbcTemplate jdbc;
    private final DataScopeService dataScope;

    public CrudController(JdbcTemplate jdbc, DataScopeService dataScope) {
        this.jdbc = jdbc;
        this.dataScope = dataScope;
    }

    private static ResponseEntity<Map<String, Object>> unknownTable(String table) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Unknown table: " + table));
    }

    /** 列表查询（客户/拜访按数据权限过滤） */
    @GetMapping("/api/{table}")
    public ResponseEntity<?> list(@PathVariable String table, HttpServletRequest req) {
        TableMeta.Meta meta = TableMeta.of(table);
        if (meta == null) return unknownTable(table);
        AuthUser auth = AuthFilter.user(req);
        try {
            boolean scoped = table.equals("clients") || table.equals("visits");
            List<String> visibleIds = scoped ? dataScope.getVisibleUserIds(auth) : null;

            StringBuilder sql = new StringBuilder();
            List<Object> params = new ArrayList<>();
            if (table.equals("visits")) {
                // 列表排除录音大字段，降低数据传输量
                String cols = TableMeta.visitListColumns().stream()
                        .map(c -> "`" + c + "`").collect(Collectors.joining(", "));
                sql.append("SELECT ").append(cols).append(" FROM `visits`");
            } else {
                sql.append("SELECT * FROM `").append(table).append("`");
            }
            if (visibleIds != null) {
                if (visibleIds.isEmpty()) return ResponseEntity.ok(List.of());
                sql.append(" WHERE ownerId IN (")
                        .append(visibleIds.stream().map(x -> "?").collect(Collectors.joining(",")))
                        .append(")");
                params.addAll(visibleIds);
            }
            if (table.equals("visits")) sql.append(" ORDER BY `date` DESC");
            List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), params.toArray());
            return ResponseEntity.ok(rows.stream().map(r -> TableMeta.mapRow(table, r)).toList());
        } catch (Exception e) {
            log.error("Fetch {} error:", table, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /** 拜访详情（含录音大字段） */
    @GetMapping("/api/visits/{id}")
    public ResponseEntity<?> visitDetail(@PathVariable String id, HttpServletRequest req) {
        AuthUser auth = AuthFilter.user(req);
        try {
            List<String> visibleIds = dataScope.getVisibleUserIds(auth);
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM visits WHERE id = ?", id);
            if (rows.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "拜访记录不存在"));
            }
            Map<String, Object> row = rows.get(0);
            if (visibleIds != null && !containsOwner(visibleIds, row.get("ownerId"))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "无权查看该拜访记录"));
            }
            return ResponseEntity.ok(TableMeta.mapRow("visits", row));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    private static boolean containsOwner(List<String> visibleIds, Object ownerId) {
        return ownerId != null && visibleIds.contains(String.valueOf(ownerId));
    }

    /** Upsert（按 id 插入或更新） */
    @PutMapping("/api/{table}")
    public ResponseEntity<?> upsert(@PathVariable String table,
                                    @RequestBody(required = false) Map<String, Object> body,
                                    HttpServletRequest req) {
        TableMeta.Meta meta = TableMeta.of(table);
        if (meta == null) return unknownTable(table);
        AuthUser auth = AuthFilter.user(req);
        body = body == null ? new HashMap<>() : new HashMap<>(body);

        // --- 写权限控制 ---
        if ((table.equals("roles") || table.equals("departments")) && !auth.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "仅管理员可维护角色与部门"));
        }
        if (table.equals("users") && !auth.isAdmin()) {
            Object bodyId = body.get("id");
            if (bodyId == null || !auth.uid().equals(String.valueOf(bodyId))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "仅管理员可修改他人信息"));
            }
            Map<String, Object> self = new HashMap<>();
            self.put("id", auth.uid());
            for (String col : SELF_UPDATE_COLS) {
                if (body.containsKey(col)) self.put(col, body.get(col));
            }
            body = self;
        }
        if ((table.equals("clients") || table.equals("visits")) && !auth.isAdmin()) {
            List<String> visibleIds = dataScope.getVisibleUserIds(auth);
            if (body.get("ownerId") == null) body.put("ownerId", auth.uid());
            if (!containsOwner(visibleIds, body.get("ownerId"))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "仅可维护本人或本部门名下的记录"));
            }
            if (body.get("id") != null) {
                List<Map<String, Object>> existing = jdbc.queryForList(
                        "SELECT ownerId FROM `" + table + "` WHERE id = ?", String.valueOf(body.get("id")));
                if (!existing.isEmpty() && !containsOwner(visibleIds, existing.get(0).get("ownerId"))) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "仅可维护本人或本部门名下的记录"));
                }
            }
        }

        Map<String, Object> row = TableMeta.prepareRow(table, body);
        if (row.get("id") == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "id is required for upsert"));
        }
        List<String> cols = new ArrayList<>(row.keySet());
        try {
            String placeholders = cols.stream().map(c -> "?").collect(Collectors.joining(", "));
            String updates = cols.stream().filter(c -> !c.equals("id"))
                    .map(c -> "`" + c + "` = VALUES(`" + c + "`)").collect(Collectors.joining(", "));
            String sql = "INSERT INTO `" + table + "` (" +
                    cols.stream().map(c -> "`" + c + "`").collect(Collectors.joining(", ")) +
                    ") VALUES (" + placeholders + ")" +
                    (updates.isEmpty() ? "" : " ON DUPLICATE KEY UPDATE " + updates);
            jdbc.update(sql, cols.stream().map(row::get).toArray());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            log.error("Upsert {} error:", table, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    /** 删除（引用保护） */
    @DeleteMapping("/api/{table}/{id}")
    public ResponseEntity<?> delete(@PathVariable String table, @PathVariable String id, HttpServletRequest req) {
        TableMeta.Meta meta = TableMeta.of(table);
        if (meta == null) return unknownTable(table);
        AuthUser auth = AuthFilter.user(req);
        try {
            // --- 数据权限 ---
            if (!auth.isAdmin()) {
                if (table.equals("users") || table.equals("roles") || table.equals("departments")) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "仅管理员可删除"));
                }
                if (table.equals("clients") || table.equals("visits")) {
                    List<String> visibleIds = dataScope.getVisibleUserIds(auth);
                    List<Map<String, Object>> existing = jdbc.queryForList(
                            "SELECT ownerId FROM `" + table + "` WHERE id = ?", id);
                    if (!existing.isEmpty() && !containsOwner(visibleIds, existing.get(0).get("ownerId"))) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "仅可删除本人或本部门名下的记录"));
                    }
                }
            }
            // --- 引用保护 ---
            if (table.equals("users")) {
                if (auth.uid().equals(id)) {
                    return ResponseEntity.badRequest().body(Map.of("error", "不能删除当前登录账号"));
                }
                long c1 = countWhere("clients", "ownerId", id);
                long c2 = countWhere("visits", "ownerId", id);
                if (c1 + c2 > 0) {
                    return ResponseEntity.badRequest().body(Map.of("error",
                            "该用户名下仍有 " + c1 + " 个客户、" + c2 + " 条拜访记录，请先移交后再删除"));
                }
            }
            if (table.equals("departments")) {
                long c1 = countWhere("departments", "parentId", id);
                long c2 = countWhere("users", "departmentId", id);
                if (c1 + c2 > 0) {
                    return ResponseEntity.badRequest().body(Map.of("error",
                            "该部门下仍有 " + c1 + " 个子部门、" + c2 + " 名成员，请先移除后再删除"));
                }
            }
            if (table.equals("roles")) {
                long c1 = countWhere("users", "roleId", id);
                if (c1 > 0) {
                    return ResponseEntity.badRequest().body(Map.of("error",
                            "仍有 " + c1 + " 名用户使用该角色，请先调整后再删除"));
                }
            }
            jdbc.update("DELETE FROM `" + table + "` WHERE id = ?", id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            log.error("Delete {} error:", table, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    private long countWhere(String table, String col, Object value) {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM `" + table + "` WHERE `" + col + "` = ?", Long.class, value);
        return n == null ? 0 : n;
    }
}
