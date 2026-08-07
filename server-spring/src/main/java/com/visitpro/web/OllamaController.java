package com.visitpro.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visitpro.config.VisitProProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Ollama 本地模型代理路由（规避浏览器 CORS），对齐 Node 版 ollamaRoutes.js。
 */
@RestController
public class OllamaController {
    private final RestClient ollamaClient;
    private final RestClient ollamaChatClient;
    private final String ollamaBase;
    private final ObjectMapper om = new ObjectMapper();

    public OllamaController(RestClient ollamaClient,
                            @org.springframework.beans.factory.annotation.Qualifier("ollamaChatClient") RestClient ollamaChatClient,
                            VisitProProperties props) {
        this.ollamaClient = ollamaClient;
        this.ollamaChatClient = ollamaChatClient;
        this.ollamaBase = props.ollama().base();
    }

    /** 获取本地已安装模型列表 */
    @GetMapping("/api/ollama/models")
    public ResponseEntity<Map<String, Object>> models() {
        try {
            String body = ollamaClient.get().uri("/api/tags").retrieve().body(String.class);
            JsonNode data = om.readTree(body);
            List<String> names = new ArrayList<>();
            for (JsonNode m : data.path("models")) names.add(m.path("name").asText());
            return ResponseEntity.ok(Map.of("success", true, "models", names));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "success", false,
                    "message", "无法连接 Ollama (" + ollamaBase + ")，请确认 ollama serve 已启动: " + e.getMessage()));
        }
    }

    /** 对话补全（OpenAI 兼容接口转发） */
    @PostMapping("/api/ollama/chat")
    public ResponseEntity<Map<String, Object>> chat(@RequestBody(required = false) Map<String, Object> body) {
        body = body == null ? Map.of() : body;
        Object model = body.get("model");
        Object messages = body.get("messages");
        boolean jsonMode = Boolean.TRUE.equals(body.get("jsonMode"));
        if (model == null || !(messages instanceof List)) {
            return ResponseEntity.badRequest().body(Map.of("error", "model and messages are required"));
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("stream", false);
        if (jsonMode) payload.put("response_format", Map.of("type", "json_object"));
        try {
            String resp = ollamaChatClient.post().uri("/v1/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve().body(String.class);
            JsonNode data = om.readTree(resp);
            String content = data.path("choices").path(0).path("message").path("content").asText("");
            return ResponseEntity.ok(Map.of("content", content));
        } catch (HttpStatusCodeException e) {
            String text = e.getResponseBodyAsString();
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error",
                    "Ollama Error " + e.getStatusCode().value() + ": "
                            + text.substring(0, Math.min(300, text.length()))));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error",
                    "无法连接 Ollama (" + ollamaBase + ")，请确认 ollama serve 已启动: " + e.getMessage()));
        }
    }
}
