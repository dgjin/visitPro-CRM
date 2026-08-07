package com.visitpro.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 鉴权过滤器：白名单路径放行，其余校验 Bearer token 并逐请求复核账号实时状态。
 * 被停用/删除的账号即使持有有效 token 也被拒绝；角色以数据库为准。
 */
@Component
public class AuthFilter extends OncePerRequestFilter {
    public static final String ATTR_USER = "authUser";
    private static final Set<String> WHITELIST = Set.of("/api/auth/login", "/api/health");

    private final JwtService jwtService;
    private final JdbcTemplate jdbc;
    private final ObjectMapper om;

    public AuthFilter(JwtService jwtService, JdbcTemplate jdbc, ObjectMapper om) {
        this.jwtService = jwtService;
        this.jdbc = jdbc;
        this.om = om;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String path = req.getRequestURI();
        if ("OPTIONS".equalsIgnoreCase(req.getMethod()) || WHITELIST.contains(path)) {
            chain.doFilter(req, res);
            return;
        }
        String header = req.getHeader("Authorization");
        String token = (header != null && header.startsWith("Bearer ")) ? header.substring(7) : null;
        if (token == null) {
            reject(res, 401, "未登录或会话已过期");
            return;
        }
        Claims claims;
        try {
            claims = jwtService.parse(token);
        } catch (RuntimeException e) {
            reject(res, 401, "登录已过期，请重新登录");
            return;
        }
        // uid 为 varchar(64)；兼容旧版本可能签发的数字 uid
        Object uidClaim = claims.get("uid");
        String uid = uidClaim == null ? null : String.valueOf(uidClaim);
        if (uid == null) {
            reject(res, 401, "登录已过期，请重新登录");
            return;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT u.id, u.status, u.departmentId, r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.id = ?",
                uid);
        if (rows.isEmpty()) {
            reject(res, 401, "账号不存在，请重新登录");
            return;
        }
        Map<String, Object> row = rows.get(0);
        if ("inactive".equals(row.get("status"))) {
            reject(res, 401, "账号已停用，请联系管理员");
            return;
        }
        String roleName = row.get("roleName") == null ? "" : row.get("roleName").toString();
        String deptId = row.get("departmentId") == null ? null : row.get("departmentId").toString();
        req.setAttribute(ATTR_USER, new AuthUser(uid, roleName, deptId));
        chain.doFilter(req, res);
    }

    private void reject(HttpServletResponse res, int status, String message) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write(om.writeValueAsString(Map.of("success", false, "message", message)));
    }

    /** 控制器取鉴权上下文 */
    public static AuthUser user(HttpServletRequest req) {
        return (AuthUser) req.getAttribute(ATTR_USER);
    }
}
