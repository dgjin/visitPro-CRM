package com.visitpro.web;

import com.visitpro.security.AuthFilter;
import com.visitpro.security.AuthUser;
import com.visitpro.security.JwtService;
import com.visitpro.security.PasswordService;
import com.visitpro.service.LoginRateLimiter;
import com.visitpro.service.TableMeta;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 认证路由：登录（含暴力破解防护）/ 会话恢复 / 改密 / 重置密码 / 登录历史
 */
@RestController
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final JdbcTemplate jdbc;
    private final JwtService jwtService;
    private final PasswordService passwordService;
    private final LoginRateLimiter rateLimiter;

    public AuthController(JdbcTemplate jdbc, JwtService jwtService,
                          PasswordService passwordService, LoginRateLimiter rateLimiter) {
        this.jdbc = jdbc;
        this.jwtService = jwtService;
        this.passwordService = passwordService;
        this.rateLimiter = rateLimiter;
    }

    /** TINYINT(1) 兼容 Boolean/Number 两种驱动映射 */
    private static boolean truthy(Object v) {
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) return n.intValue() != 0;
        return v != null && !"0".equals(v.toString());
    }

    /** 用户行 -> 前端用户对象（剔除密码，附加 role/mustChangePassword） */
    private Map<String, Object> toUserPayload(Map<String, Object> row) {
        Map<String, Object> user = TableMeta.mapRow("users", row);
        user.put("role", row.get("roleName") == null ? "" : row.get("roleName").toString());
        user.put("mustChangePassword", truthy(row.get("must_change_password")));
        return user;
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody(required = false) Map<String, Object> body,
                                                     HttpServletRequest req) {
        body = body == null ? Map.of() : body;
        // email 字段兼容手机号登录（账号 = 邮箱或手机号）
        String identifier = body.get("email") instanceof String s ? s.trim() : "";
        String passwordHash = body.get("passwordHash") instanceof String s ? s : null;
        String userAgent = body.get("userAgent") instanceof String s ? s : null;
        if (identifier.isEmpty() || passwordHash == null || passwordHash.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "缺少账号或密码"));
        }
        String attemptKey = LoginRateLimiter.key(identifier, req.getRemoteAddr());
        Integer lockMinutes = rateLimiter.checkLock(attemptKey);
        if (lockMinutes != null) {
            return ResponseEntity.ok(Map.of("success", false,
                    "message", "失败次数过多，账号已临时锁定，请 " + lockMinutes + " 分钟后再试"));
        }
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT u.*, r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.email = ? OR u.phone = ?",
                    identifier, identifier);
            if (rows.isEmpty()) {
                rateLimiter.recordFail(attemptKey);
                return ResponseEntity.ok(Map.of("success", false, "message", "用户不存在或账号错误"));
            }
            Map<String, Object> user = rows.get(0);
            if ("inactive".equals(user.get("status"))) {
                return ResponseEntity.ok(Map.of("success", false, "message", "账号已停用，请联系管理员"));
            }
            String stored = user.get("password") == null ? null : user.get("password").toString();
            if (!passwordService.verify(stored, passwordHash)) {
                boolean locked = rateLimiter.recordFail(attemptKey);
                return ResponseEntity.ok(Map.of("success", false,
                        "message", locked ? "失败次数过多，账号已临时锁定，请稍后再试" : "密码错误"));
            }

            // 登录成功：清除失败计数
            rateLimiter.clear(attemptKey);
            String userId = String.valueOf(user.get("id"));

            // 旧 SHA-256 哈希登录成功后透明升级为 bcrypt 加盐存储
            if (passwordService.isLegacyHash(stored)) {
                jdbc.update("UPDATE users SET password = ? WHERE id = ?",
                        passwordService.hashForStorage(passwordHash), userId);
            }

            String now = TableMeta.toMySqlDatetime(Instant.now());
            jdbc.update("UPDATE users SET last_login_at = ? WHERE id = ?", now, userId);
            jdbc.update("INSERT INTO login_history (user_id, login_at, ip_address, user_agent) VALUES (?, ?, ?, ?)",
                    userId, now, req.getRemoteAddr(), userAgent);
            // 登录历史只保留 180 天
            try {
                jdbc.update("DELETE FROM login_history WHERE login_at < DATE_SUB(NOW(), INTERVAL 180 DAY)");
            } catch (RuntimeException ignored) {
            }

            String roleName = user.get("roleName") == null ? "" : user.get("roleName").toString();
            String deptId = user.get("departmentId") == null ? null : user.get("departmentId").toString();
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("success", true);
            res.put("token", jwtService.signToken(userId, roleName, deptId));
            res.put("user", toUserPayload(user));
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            log.error("Login error:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", String.valueOf(e.getMessage())));
        }
    }

    /** 会话恢复：凭 token 取当前用户 */
    @GetMapping("/api/auth/me")
    public ResponseEntity<Map<String, Object>> me(HttpServletRequest req) {
        AuthUser auth = AuthFilter.user(req);
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT u.*, r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.id = ?",
                    auth.uid());
            if (rows.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "用户不存在"));
            }
            return ResponseEntity.ok(Map.of("success", true, "user", toUserPayload(rows.get(0))));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", String.valueOf(e.getMessage())));
        }
    }

    /** 本人改密（首次强制改密 / 自主修改） */
    @PostMapping("/api/auth/change-password")
    public ResponseEntity<Map<String, Object>> changePassword(@RequestBody(required = false) Map<String, Object> body,
                                                              HttpServletRequest req) {
        AuthUser auth = AuthFilter.user(req);
        body = body == null ? Map.of() : body;
        String currentPasswordHash = body.get("currentPasswordHash") instanceof String s ? s : null;
        String newPasswordHash = body.get("newPasswordHash") instanceof String s ? s : null;
        if (newPasswordHash == null || newPasswordHash.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "新密码强度不足"));
        }
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM users WHERE id = ?", auth.uid());
            if (rows.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "用户不存在"));
            }
            String stored = rows.get(0).get("password") == null ? null : rows.get(0).get("password").toString();
            if (!passwordService.verify(stored, currentPasswordHash)) {
                return ResponseEntity.ok(Map.of("success", false, "message", "当前密码错误"));
            }
            jdbc.update("UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?",
                    passwordService.hashForStorage(newPasswordHash), auth.uid());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", String.valueOf(e.getMessage())));
        }
    }

    /** 管理员重置他人密码（重置后强制改密） */
    @PostMapping("/api/auth/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody(required = false) Map<String, Object> body,
                                                             HttpServletRequest req) {
        AuthUser auth = AuthFilter.user(req);
        if (!auth.isAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("success", false, "message", "仅管理员可重置密码"));
        }
        body = body == null ? Map.of() : body;
        Object userId = body.get("userId");
        String newPasswordHash = body.get("newPasswordHash") instanceof String s ? s : null;
        if (userId == null || newPasswordHash == null || newPasswordHash.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "参数无效"));
        }
        try {
            String targetId = String.valueOf(userId);
            int affected = jdbc.update("UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?",
                    passwordService.hashForStorage(newPasswordHash), targetId);
            if (affected == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "用户不存在"));
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", String.valueOf(e.getMessage())));
        }
    }

    /** 登录历史（本人或管理员可查） */
    @GetMapping("/api/login-history/{userId}")
    public ResponseEntity<?> loginHistory(@PathVariable String userId, HttpServletRequest req) {
        AuthUser auth = AuthFilter.user(req);
        if (!auth.isAdmin() && !String.valueOf(auth.uid()).equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "无权查看他人登录历史"));
        }
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT * FROM login_history WHERE user_id = ? ORDER BY login_at DESC LIMIT 50",
                    userId);
            List<Map<String, Object>> out = new ArrayList<>();
            for (Map<String, Object> r : rows) {
                Map<String, Object> item = new LinkedHashMap<>(r);
                if (item.get("login_at") instanceof LocalDateTime ldt) {
                    item.put("login_at", ldt.toInstant(java.time.ZoneOffset.UTC).toString());
                }
                item.put("id", String.valueOf(item.get("id")));
                out.add(item);
            }
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            log.error("Login history error:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }
}
