package com.visitpro.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visitpro.ai.AiClient;
import com.visitpro.ai.AiQueryService;
import com.visitpro.ai.AiQueryService.FetchResult;
import com.visitpro.ai.AiQueryService.Plan;
import com.visitpro.ai.AiQueryService.Resolved;
import com.visitpro.security.AuthFilter;
import com.visitpro.security.AuthUser;
import com.visitpro.service.DataScopeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;

/**
 * 智能问数路由（对齐 Node 版 aiRoutes.js）：
 * 输入净化 → LLM 计划解析 → 白名单校验 → 参数化取数（含数据权限）→ 图表/表格 → LLM 流式总结。
 */
@RestController
public class AiController {
    private static final Logger log = LoggerFactory.getLogger(AiController.class);

    private record QueryResult(String answer, String scopeNote, List<Plan> plans) {}

    /** 单用户并发闸门：LLM 调用慢且贵，防止重复点击打爆服务 */
    private final Set<String> aiBusyUsers = ConcurrentHashMap.newKeySet();

    private final AiClient aiClient;
    private final AiQueryService aiQueryService;
    private final DataScopeService dataScope;
    private final JdbcTemplate jdbc;
    private final ObjectMapper om;

    public AiController(AiClient aiClient, AiQueryService aiQueryService,
                        DataScopeService dataScope, JdbcTemplate jdbc, ObjectMapper om) {
        this.aiClient = aiClient;
        this.aiQueryService = aiQueryService;
        this.dataScope = dataScope;
        this.jdbc = jdbc;
        this.om = om;
    }

    /** 审计日志：问数请求全程留痕（失败也记录） */
    private void auditAiQuery(String userId, String question, String status, String detail) {
        try {
            jdbc.update("INSERT INTO ai_query_history (user_id, question, status, detail) VALUES (?, ?, ?, ?)",
                    userId, question, status,
                    detail == null ? null : detail.substring(0, Math.min(2000, detail.length())));
        } catch (RuntimeException ignored) {
        }
    }

    /** 智能问数可用性（前端据此提示/隐藏入口） */
    @GetMapping("/api/ai/config")
    public Map<String, Object> aiConfig() {
        return Map.of("enabled", aiClient.isAvailable());
    }

    /** SSE 流式问数：事件类型 status | text_only | plan | chart | table | answer_delta | scope_note | done | error */
    @PostMapping("/api/ai/query/stream")
    public void queryStream(@RequestBody(required = false) Map<String, Object> body,
                            HttpServletRequest req, HttpServletResponse res) throws Exception {
        AuthUser auth = AuthFilter.user(req);
        body = body == null ? Map.of() : body;
        Object questionObj = body.get("question");
        String question = questionObj instanceof String s ? s : null;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> history = body.get("history") instanceof List<?> l
                ? (List<Map<String, Object>>) l : null;

        if (!aiBusyUsers.add(auth.uid())) {
            res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write(om.writeValueAsString(Map.of("error", "您有一个问数请求正在处理中，请稍候")));
            return;
        }

        res.setContentType("text/event-stream;charset=UTF-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        PrintWriter writer = res.getWriter();
        BiConsumer<String, Object> send = (type, data) -> {
            if (writer.checkError()) return; // 连接已断开
            try {
                String payload = data instanceof String s ? s : om.writeValueAsString(data);
                writer.write("event: " + type + "\ndata: " + payload + "\n\n");
                writer.flush();
            } catch (Exception ignored) {
            }
        };

        try {
            QueryResult result = runAiQuery(question, history, auth, send);
            String detail;
            if (result != null) {
                detail = om.writeValueAsString(result.plans().stream()
                        .map(p -> Map.of("dataset", p.dataset, "dimension", p.dimension))
                        .toList());
            } else {
                detail = "text_only";
            }
            auditAiQuery(auth.uid(), question == null ? "" : question.substring(0, Math.min(500, question.length())),
                    "success", detail);
            send.accept("done", "");
        } catch (Exception e) {
            log.error("AI query error:", e);
            auditAiQuery(auth.uid(), question == null ? "" : question.substring(0, Math.min(500, question.length())),
                    "error", e.getMessage());
            send.accept("error", Map.of("error", "问数服务异常，请稍后重试"));
        } finally {
            aiBusyUsers.remove(auth.uid());
            writer.flush();
            writer.close();
        }
    }

    /** 问数编排：输入净化 → 计划解析 → 取数 → 结果构建；通过 send 推送 SSE 事件 */
    private QueryResult runAiQuery(String question, List<Map<String, Object>> history,
                                   AuthUser auth, BiConsumer<String, Object> send) throws Exception {
        String safeQuestion = AiQueryService.sanitizeQuestion(question);
        if (safeQuestion == null) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("answer", "您的问题包含不支持的指令，请重新描述您的数据需求。");
            payload.put("scope_note", null);
            send.accept("text_only", payload);
            return null;
        }

        send.accept("status", "正在理解您的问题...");
        List<String> visibleIds = dataScope.getVisibleUserIds(auth);

        // LLM Call #1: 生成查询计划（json 模式）
        String planJson;
        try {
            planJson = aiClient.aiChat(
                    AiQueryService.buildPlanMessages(safeQuestion, AiQueryService.sanitizeHistory(history)), true);
        } catch (Exception e) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("answer", "AI 服务暂时不可用：" + e.getMessage());
            payload.put("scope_note", null);
            send.accept("text_only", payload);
            return null;
        }
        Resolved resolved = AiQueryService.resolvePlan(planJson);
        if (resolved.textAnswer() != null) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("answer", resolved.textAnswer());
            payload.put("scope_note", null);
            send.accept("text_only", payload);
            return null;
        }
        List<Plan> plans = resolved.plans();

        send.accept("status", "正在查询数据...");
        // 逐个执行子分析（复合计划 2~4 个视角），事件带 index 供前端分组渲染
        List<FetchResult> results = new ArrayList<>();
        for (int i = 0; i < plans.size(); i++) {
            Plan plan = plans.get(i);
            FetchResult data = aiQueryService.fetchData(plan, visibleIds);
            results.add(data);
            AiQueryService.Dataset ds = AiQueryService.DATASETS.get(plan.dataset);

            Map<String, Object> planEvent = new LinkedHashMap<>();
            planEvent.put("index", i);
            planEvent.put("analysis_count", plans.size());
            planEvent.put("dataset", plan.dataset);
            planEvent.put("dataset_label", ds.label());
            planEvent.put("dimension", plan.dimension);
            planEvent.put("recent_months", plan.recentMonths);
            planEvent.put("owner_names", plan.ownerNames);
            planEvent.put("chart_type", plan.chartType);
            planEvent.put("title", plan.title);
            send.accept("plan", planEvent);

            Map<String, Object> chart = AiQueryService.buildChart(data, plan);
            if (chart != null) {
                chart.put("index", i);
                send.accept("chart", chart);
            }
            send.accept("table", Map.of("index", i, "columns", data.columns(), "rows", data.rows()));
        }

        String scopeNote = plans.size() == 1
                ? AiQueryService.buildScopeNote(plans.get(0), AiQueryService.DATASETS.get(plans.get(0).dataset).label(),
                        results.get(0).dimensionLabel(), plans.get(0).ownerNames)
                : AiQueryService.buildCombinedScopeNote(plans);

        send.accept("status", "正在生成结论...");
        // LLM Call #2: 基于查询结果总结（非流式：思考型模型流式只吐 reasoning，易耗尽 token 致正文为空）
        String answer;
        try {
            answer = aiClient.aiChat(
                    AiQueryService.buildSummaryMessages(safeQuestion, plans, results, scopeNote), false, 4096);
            if (answer == null || answer.isBlank()) {
                throw new RuntimeException("模型返回内容为空（推理可能耗尽 token 配额）");
            }
            send.accept("answer_delta", answer);
        } catch (Exception e) {
            // 总结失败不阻塞：回退为直接展示数据行数
            int totalRows = results.stream().mapToInt(d -> d.rows().size()).sum();
            answer = "查询完成，共 " + totalRows + " 组数据。（AI 总结失败：" + e.getMessage() + "）";
            send.accept("answer_delta", answer);
        }

        send.accept("scope_note", scopeNote);
        return new QueryResult(answer, scopeNote, plans);
    }
}
