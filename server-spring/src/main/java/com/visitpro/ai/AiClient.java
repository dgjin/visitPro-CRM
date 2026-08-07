package com.visitpro.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visitpro.config.VisitProProperties;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * AI 客户端（OpenAI 兼容接口：DeepSeek / Moonshot / Ollama / 自建网关均可）。
 * 对齐 Node 版 aiQuery.js 的 aiChat / aiChatStream。
 */
@Component
public class AiClient {
    private final VisitProProperties.Ai cfg;
    private final ObjectMapper om = new ObjectMapper();
    private final HttpClient http;

    public AiClient(VisitProProperties props) {
        String baseUrl = props.ai().baseUrl() == null ? "" : props.ai().baseUrl().replaceAll("/+$", "");
        this.cfg = new VisitProProperties.Ai(baseUrl, props.ai().apiKey(), props.ai().model(), props.ai().timeoutMs());
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.min(cfg.timeoutMs(), 10_000)))
                .build();
    }

    /** 智能问数是否可用（未配置 Key 时前端隐藏入口） */
    public boolean isAvailable() {
        return cfg.apiKey() != null && !cfg.apiKey().isBlank()
                && cfg.baseUrl() != null && !cfg.baseUrl().isBlank();
    }

    private HttpRequest.Builder baseRequest(Map<String, Object> body) throws Exception {
        if (cfg.apiKey() == null || cfg.apiKey().isBlank() || cfg.baseUrl().isBlank()) {
            throw new IllegalStateException("智能问数未配置，请在 server/.env 中配置 AI_API_KEY");
        }
        return HttpRequest.newBuilder()
                .uri(URI.create(cfg.baseUrl() + "/chat/completions"))
                .timeout(Duration.ofMillis(cfg.timeoutMs()))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + cfg.apiKey())
                .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(body), StandardCharsets.UTF_8));
    }

    /** 发起一次对话补全调用，返回模型文本 */
    public String aiChat(List<Map<String, String>> messages, boolean jsonMode) throws Exception {
        return aiChat(messages, jsonMode, 2048);
    }

    /**
     * 发起一次对话补全调用，返回模型文本。
     * 注意：总结类调用务必用非流式——思考型模型（如 qwen3）的流式输出先只吐 reasoning，
     * 且推理链可能耗尽 max_tokens 导致正文为空。
     */
    public String aiChat(List<Map<String, String>> messages, boolean jsonMode, int maxTokens) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", cfg.model());
        body.put("messages", messages);
        body.put("temperature", jsonMode ? 0 : 0.3);
        body.put("stream", false);
        body.put("max_tokens", maxTokens);
        if (jsonMode) body.put("response_format", Map.of("type", "json_object"));

        HttpResponse<String> r = http.send(baseRequest(body).build(), HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() < 200 || r.statusCode() >= 300) {
            String text = r.body() == null ? "" : r.body();
            throw new RuntimeException("AI 服务调用失败 (" + r.statusCode() + "): "
                    + text.substring(0, Math.min(300, text.length())));
        }
        JsonNode data = om.readTree(r.body());
        return data.path("choices").path(0).path("message").path("content").asText("");
    }

    /** 流式对话补全：逐片段回调 onChunk，返回拼接后的完整文本 */
    public String aiChatStream(List<Map<String, String>> messages, Consumer<String> onChunk) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", cfg.model());
        body.put("messages", messages);
        body.put("temperature", 0.3);
        body.put("stream", true);
        body.put("max_tokens", 1024);

        HttpResponse<java.io.InputStream> r = http.send(baseRequest(body).build(),
                HttpResponse.BodyHandlers.ofInputStream());
        if (r.statusCode() < 200 || r.statusCode() >= 300) {
            String text = new String(r.body().readAllBytes(), StandardCharsets.UTF_8);
            throw new RuntimeException("AI 服务调用失败 (" + r.statusCode() + "): "
                    + text.substring(0, Math.min(300, text.length())));
        }
        StringBuilder full = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(r.body(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                String payload = trimmed.substring(5).trim();
                if (payload.equals("[DONE]")) continue;
                try {
                    String delta = om.readTree(payload).path("choices").path(0).path("delta").path("content").asText("");
                    if (!delta.isEmpty()) {
                        full.append(delta);
                        onChunk.accept(delta);
                    }
                } catch (RuntimeException ignored) {
                    // 忽略不完整的 SSE 分片
                }
            }
        }
        return full.toString();
    }
}
