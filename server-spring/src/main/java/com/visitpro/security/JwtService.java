package com.visitpro.security;

import com.visitpro.config.VisitProProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;

/**
 * JWT 签发/校验：HS256，与 Node jsonwebtoken 令牌互操作，
 * 沿用同一 JWT_SECRET 保证迁移后现有登录会话仍然有效。
 */
@Service
public class JwtService {
    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final VisitProProperties props;
    private SecretKey key;
    private Duration ttl = Duration.ofDays(7);

    public JwtService(VisitProProperties props) {
        this.props = props;
    }

    @PostConstruct
    void init() {
        String secret = props.jwt().secret();
        if (secret == null || secret.isBlank()) {
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            secret = HexFormat.of().formatHex(random);
            log.warn("未配置 JWT_SECRET，使用随机密钥（服务重启后所有登录会话失效）。生产环境请配置固定密钥。");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = parseTtl(props.jwt().ttl());
    }

    /** 解析 '7d' / '12h' / '30m' / 秒数 形式的有效期，非法时回退 7d */
    static Duration parseTtl(String ttl) {
        if (ttl == null || ttl.isBlank()) return Duration.ofDays(7);
        try {
            String t = ttl.trim().toLowerCase();
            char unit = t.charAt(t.length() - 1);
            long n;
            if (Character.isDigit(unit)) {
                return Duration.ofSeconds(Long.parseLong(t));
            }
            n = Long.parseLong(t.substring(0, t.length() - 1));
            return switch (unit) {
                case 'd' -> Duration.ofDays(n);
                case 'h' -> Duration.ofHours(n);
                case 'm' -> Duration.ofMinutes(n);
                case 's' -> Duration.ofSeconds(n);
                default -> Duration.ofDays(7);
            };
        } catch (RuntimeException e) {
            return Duration.ofDays(7);
        }
    }

    /** 载荷与 Node 版一致：{ uid, role, deptId } */
    public String signToken(String uid, String role, String deptId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .claim("uid", uid)
                .claim("role", role == null ? "" : role)
                .claim("deptId", deptId)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /** 校验并返回载荷；非法/过期抛异常 */
    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
    }
}
