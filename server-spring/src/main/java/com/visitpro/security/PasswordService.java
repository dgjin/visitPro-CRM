package com.visitpro.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * 密码：服务端 bcrypt 加盐存储；兼容旧 SHA-256 哈希（登录时自动升级）。
 * 前端传输 SHA-256(明文)，服务端对该摘要再做 bcrypt（本地 HTTP 环境不传明文）。
 */
@Component
public class PasswordService {
    private static final Pattern LEGACY_HASH = Pattern.compile("^[a-f0-9]{64}$");

    private final BCryptPasswordEncoder encoder;

    public PasswordService(BCryptPasswordEncoder encoder) {
        this.encoder = encoder;
    }

    public boolean isLegacyHash(String v) {
        return v != null && LEGACY_HASH.matcher(v).matches();
    }

    public boolean verify(String stored, String receivedHash) {
        if (stored == null || stored.isEmpty() || receivedHash == null || receivedHash.isEmpty()) return false;
        if (isLegacyHash(stored)) return stored.equals(receivedHash);
        try {
            return encoder.matches(receivedHash, stored);
        } catch (RuntimeException e) {
            return false;
        }
    }

    public String hashForStorage(String receivedHash) {
        return encoder.encode(receivedHash);
    }
}
