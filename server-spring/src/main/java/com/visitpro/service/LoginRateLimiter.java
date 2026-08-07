package com.visitpro.service;

import com.visitpro.config.VisitProProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 登录暴力破解防护：同一账号+IP 失败 N 次后锁定 M 分钟（内存计数，重启清零）。
 */
@Service
public class LoginRateLimiter {
    private record Attempt(int count, long lockedUntil) {}

    private final int maxFails;
    private final long lockMs;
    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public LoginRateLimiter(VisitProProperties props) {
        this.maxFails = props.login().maxFails();
        this.lockMs = props.login().lockMinutes() * 60_000L;
    }

    public static String key(String identifier, String ip) {
        return identifier.toLowerCase() + "|" + ip;
    }

    /** 返回剩余锁定分钟数；未锁定返回 null */
    public Integer checkLock(String key) {
        Attempt rec = attempts.get(key);
        if (rec != null && rec.lockedUntil() > System.currentTimeMillis()) {
            return (int) Math.ceil((rec.lockedUntil() - System.currentTimeMillis()) / 60_000.0);
        }
        return null;
    }

    /** 记录一次失败；返回是否已触发锁定 */
    public boolean recordFail(String key) {
        Attempt[] result = new Attempt[1];
        attempts.compute(key, (k, rec) -> {
            int count = (rec == null ? 0 : rec.count()) + 1;
            long lockedUntil = rec == null ? 0 : rec.lockedUntil();
            if (count >= maxFails) {
                lockedUntil = System.currentTimeMillis() + lockMs;
                count = 0;
            }
            result[0] = new Attempt(count, lockedUntil);
            return result[0];
        });
        return result[0].lockedUntil() > System.currentTimeMillis();
    }

    public void clear(String key) {
        attempts.remove(key);
    }

    /** 定期清理过期记录，防止内存缓慢增长 */
    @Scheduled(fixedDelay = 10 * 60 * 1000)
    void cleanup() {
        long now = System.currentTimeMillis();
        attempts.entrySet().removeIf(e -> {
            Attempt rec = e.getValue();
            return (rec.lockedUntil() == 0 || rec.lockedUntil() < now) && rec.count() == 0;
        });
    }
}
