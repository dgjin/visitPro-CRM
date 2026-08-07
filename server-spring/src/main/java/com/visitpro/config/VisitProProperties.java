package com.visitpro.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/** visitpro.* 配置绑定（环境变量与 Node 版 server/.env 同名） */
@ConfigurationProperties(prefix = "visitpro")
public record VisitProProperties(
        Jwt jwt,
        Cors cors,
        Login login,
        Ollama ollama,
        Ai ai
) {
    public record Jwt(String secret, String ttl) {}
    public record Cors(List<String> origins) {}
    public record Login(int maxFails, int lockMinutes) {}
    public record Ollama(String base) {}
    public record Ai(String baseUrl, String apiKey, String model, long timeoutMs) {}
}
