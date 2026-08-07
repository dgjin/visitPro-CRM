package com.visitpro.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 智能问数模块（对齐 Node 版 aiQuery.js）：
 * 自然语言 → LLM 解析为白名单查询计划 → 参数化 SQL 取数（含数据权限）→ 表格/图表构建 → LLM 流式总结。
 * 大模型只负责「理解问题」与「总结数据」，绝不生成 SQL；取数一律走白名单 + 参数化查询。
 */
@Service
public class AiQueryService {

    // ---- 数据集白名单：可问数维度 / 时间列 / 标签 ----
    public record Dimension(String label, String expr) {}
    public record Dataset(String label, String table, String timeCutoffExpr, Map<String, Dimension> dimensions) {}

    public static final Map<String, Dataset> DATASETS = Map.of(
            "clients", new Dataset("客户", "clients",
                    // created_at 为 DATETIME，按日期比较
                    "DATE(`created_at`)",
                    Map.of(
                            "industry", new Dimension("行业", "`industry`"),
                            "region", new Dimension("地区", "`region`"),
                            "clientType", new Dimension("客户类型", "`clientType`"),
                            "owner", new Dimension("负责人", "`ownerName`"))),
            "visits", new Dataset("拜访", "visits",
                    // date 为 varchar（ISO 字符串），取前 10 位按 'YYYY-MM-DD' 做字典序比较
                    "LEFT(`date`, 10)",
                    Map.of(
                            "type", new Dimension("拜访类型", "`type`"),
                            "sentiment", new Dimension("拜访氛围", "`sentiment`"),
                            "owner", new Dimension("负责人", "`ownerName`"),
                            "month", new Dimension("月份", "LEFT(`date`, 7)")))
    );

    /** 「总计」维度：不按任何字段分组 */
    public static final String NONE_DIMENSION = "none";

    /** 单次复合计划最多执行的子分析数，控制 LLM 调用成本与响应时长 */
    public static final int MAX_ANALYSES = 4;

    // ---- 输入净化：防 prompt injection ----
    private static final int MAX_QUESTION_LENGTH = 500;
    private static final int MAX_HISTORY_CONTENT_LENGTH = 300;
    private static final Pattern PROTOCOL_INJECTION =
            Pattern.compile("system\\s*:|<\\|[^|]*\\|>|\\[INST]|<<SYS>>|\\[/INST]|<</SYS>>", Pattern.CASE_INSENSITIVE);

    private static final ObjectMapper OM = new ObjectMapper();

    private final JdbcTemplate jdbc;

    public AiQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static String sanitizeQuestion(Object question) {
        if (!(question instanceof String q)) return null;
        String cleaned = q.trim();
        if (cleaned.isEmpty()) return null;
        if (cleaned.length() > MAX_QUESTION_LENGTH) cleaned = cleaned.substring(0, MAX_QUESTION_LENGTH);
        int meaningfulLen = cleaned.length();
        cleaned = PROTOCOL_INJECTION.matcher(cleaned).replaceAll("[已过滤]");
        // 过滤后剩余有效内容不足原文 30%：视为纯注入攻击，整体拒绝
        if (cleaned.isEmpty()
                || cleaned.replace("[已过滤]", "").length() < meaningfulLen * 0.3) return null;
        return cleaned;
    }

    /** 历史消息仅保留 user 消息，避免上一轮实际数据泄露给 LLM */
    public static List<Map<String, String>> sanitizeHistory(List<Map<String, Object>> history) {
        List<Map<String, String>> out = new ArrayList<>();
        if (history == null) return out;
        for (Map<String, Object> h : history) {
            if (h == null || !"user".equals(h.get("role"))) continue;
            Object content = h.get("content");
            if (!(content instanceof String s) || s.trim().isEmpty()) continue;
            String c = s.length() > MAX_HISTORY_CONTENT_LENGTH ? s.substring(0, MAX_HISTORY_CONTENT_LENGTH) : s;
            out.add(Map.of("role", "user", "content", PROTOCOL_INJECTION.matcher(c).replaceAll("[已过滤]")));
        }
        return out;
    }

    // ---- 计划解析：构建 prompt + 白名单校验 ----

    private static String buildCatalog() {
        StringBuilder catalog = new StringBuilder();
        for (Map.Entry<String, Dataset> e : DATASETS.entrySet()) {
            catalog.append("- 数据集=").append(e.getKey()).append("（").append(e.getValue().label())
                    .append("）可用分组维度: ");
            catalog.append(e.getValue().dimensions().entrySet().stream()
                    .map(d -> d.getKey() + "(" + d.getValue().label() + ")")
                    .collect(Collectors.joining("、")));
            catalog.append("；另有 ").append(NONE_DIMENSION).append("(仅统计总数)\n");
        }
        return catalog.toString();
    }

    public static List<Map<String, String>> buildPlanMessages(String question, List<Map<String, String>> history) {
        String systemPrompt = """
                你是 CRM 系统的数据查询助手。用户用自然语言提问，你需要把问题解析成 JSON 查询计划。

                当前可查询的数据集：
                """ + buildCatalog() + """
                说明：clients 是客户档案（含行业/地区/类型/负责人），visits 是拜访记录（含拜访类型/氛围/负责人/拜访日期）。

                统计口径固定为「记录条数」。

                根据问题类型输出两种格式之一：

                【单一问题】（明确问某一个分布/趋势/总数）直接输出：
                {"dataset": ..., "dimension": ..., "recent_months": ..., "owner_names": [...], "chart_type": ..., "title": ..., "unanswerable_reason": null}

                【开放式/综合性问题】（如"分析客户情况""综合统计""整体情况""详细分析"）输出复合计划，拆解为 2~4 个最有价值的子分析：
                {"recent_months": ..., "owner_names": [...], "analyses": [{"dataset": ..., "dimension": ..., "chart_type": ..., "title": ...}, ...], "unanswerable_reason": null}
                拆解优先：客户类问题优先覆盖 行业/地区/客户类型 等视角；拜访类问题优先覆盖 月份趋势/拜访类型/拜访氛围。
                复合计划中不要包含仅统计总数（dimension=none）的子分析。

                字段说明：
                - dataset: "clients" 或 "visits"，必须来自上面清单
                - dimension: 分组维度，必须来自该数据集的「可用分组维度」；问趋势/按月统计选 month（仅 visits）；只在明确问总数时选 none
                - recent_months: 整数或 null；「当前/目前/现有」表示不限时间（null）；「最近三个月/近半年/今年」换算为月数（最多 36）
                - owner_names: 字符串数组；用户点名了具体负责人时填写，否则留空数组表示全部
                - chart_type: "bar" | "line" | "pie" | "table"；趋势用 line，分类对比用 bar，占比用 pie，仅总数用 table
                - title: 简短中文图表标题
                - unanswerable_reason: 若问题与客户/拜访数据无关，填写一句中文说明；否则为 null

                注意：不要编造清单外的数据集或维度；不要输出 JSON 以外的任何文字。""";

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        List<Map<String, String>> recent = history == null ? List.of()
                : history.subList(Math.max(0, history.size() - 6), history.size());
        for (Map<String, String> h : recent) messages.add(Map.of("role", h.get("role"), "content", h.get("content")));
        messages.add(Map.of("role", "user", "content", question));
        return messages;
    }

    /** 宽松解析模型输出的 JSON（可能包裹说明文字或代码块） */
    static JsonNode parseJsonLoose(String raw) {
        if (raw == null || raw.isEmpty()) return null;
        try {
            return OM.readTree(raw);
        } catch (Exception ignored) {
            // 继续尝试截取
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return OM.readTree(raw.substring(start, end + 1));
            } catch (Exception ignored) {
                // fall through
            }
        }
        return null;
    }

    /** 已校验的查询计划（复合计划时为其中一个子分析） */
    public static final class Plan {
        public String dataset;
        public String dimension;
        public Integer recentMonths;
        public List<String> ownerNames;
        public String chartType;
        public String title;
    }

    /** resolvePlan 结果：1~N 个计划 或 直答文本 */
    public record Resolved(List<Plan> plans, String textAnswer) {
        /** 便捷访问：单一计划场景（兼容既有调用与测试） */
        public Plan plan() {
            return plans == null || plans.isEmpty() ? null : plans.get(0);
        }
    }

    /** 解析并白名单校验查询计划（支持单一计划与 analyses 复合计划两种格式） */
    public static Resolved resolvePlan(String planJson) {
        String scopeHint = "当前可问数的数据集有：客户（行业/地区/类型/负责人）、拜访（类型/氛围/负责人/月份）。";
        JsonNode plan = parseJsonLoose(planJson);
        if (plan == null || !plan.isObject()) {
            return new Resolved(null, "没能理解这个问题，请换一种说法，例如「各行业客户数量分布」。" + scopeHint);
        }

        String unanswerable = plan.path("unanswerable_reason").asText("").trim();
        if (!unanswerable.isEmpty() && !unanswerable.equals("null")) {
            return new Resolved(null, unanswerable + scopeHint);
        }

        // 公共过滤条件（复合计划写在顶层，子分析可覆盖）
        Integer commonMonths = parseRecentMonths(plan.get("recent_months"));
        List<String> commonOwners = parseOwnerNames(plan.get("owner_names"));

        JsonNode analyses = plan.get("analyses");
        if (analyses != null && analyses.isArray() && analyses.size() > 0) {
            List<Plan> plans = new ArrayList<>();
            for (JsonNode node : analyses) {
                if (plans.size() >= MAX_ANALYSES) break;
                if (node == null || !node.isObject()) continue;
                Plan p = parseOnePlan(node, commonMonths, commonOwners);
                if (p != null) plans.add(p);
            }
            if (plans.isEmpty()) {
                return new Resolved(null, "没能识别出有效的分析视角，请换一种说法，例如「各行业客户数量分布」。" + scopeHint);
            }
            return new Resolved(plans, null);
        }

        Plan p = parseOnePlan(plan, commonMonths, commonOwners);
        if (p == null) {
            return new Resolved(null, "没能定位到您要查询的数据集。" + scopeHint);
        }
        return new Resolved(List.of(p), null);
    }

    /** 解析单个子分析；数据集非法返回 null */
    private static Plan parseOnePlan(JsonNode node, Integer commonMonths, List<String> commonOwners) {
        String datasetKey = node.path("dataset").asText("");
        Dataset ds = DATASETS.get(datasetKey);
        if (ds == null) return null;

        // 维度白名单校验；非法维度回退为「总数」
        String dimension = node.path("dimension").asText("");
        if (!dimension.equals(NONE_DIMENSION) && !ds.dimensions().containsKey(dimension)) {
            dimension = NONE_DIMENSION;
        }

        Integer recentMonths = node.has("recent_months")
                ? parseRecentMonths(node.get("recent_months")) : commonMonths;
        // month 趋势维度默认给足 12 个月窗口，避免只看 1 个月画不出趋势
        if (dimension.equals("month") && recentMonths == null) recentMonths = 12;

        List<String> ownerNames = node.has("owner_names")
                ? parseOwnerNames(node.get("owner_names")) : new ArrayList<>(commonOwners);

        String chartType = node.path("chart_type").asText("");
        if (!List.of("line", "pie", "table").contains(chartType)) chartType = "bar";
        String title = node.path("title").asText("").trim();
        title = title.isEmpty() ? ds.label() + "统计"
                : title.substring(0, Math.min(60, title.length()));

        Plan p = new Plan();
        p.dataset = datasetKey;
        p.dimension = dimension;
        p.recentMonths = recentMonths;
        p.ownerNames = ownerNames;
        p.chartType = chartType;
        p.title = title;
        return p;
    }

    /** 时间范围：仅接受 1~36 的整数月 */
    private static Integer parseRecentMonths(JsonNode rm) {
        if (rm != null && rm.isIntegralNumber()) {
            long v = rm.asLong();
            if (v > 0) return (int) Math.min(v, 36);
        }
        return null;
    }

    /** 负责人过滤：去重、最多 5 个 */
    private static List<String> parseOwnerNames(JsonNode on) {
        List<String> ownerNames = new ArrayList<>();
        if (on != null && on.isArray()) {
            Set<String> seen = new LinkedHashSet<>();
            for (JsonNode n : on) {
                if (n.isTextual() && !n.asText().trim().isEmpty()) seen.add(n.asText());
            }
            ownerNames.addAll(seen.stream().limit(5).toList());
        }
        return ownerNames;
    }

    // ---- 取数：白名单列 + 参数化 SQL + 数据权限（visibleIds） ----

    public record FetchResult(List<String> columns, List<List<Object>> rows, String dimensionLabel) {}

    /**
     * @param plan       已校验的查询计划
     * @param visibleIds null=不限制（管理员）
     */
    public FetchResult fetchData(Plan plan, List<String> visibleIds) {
        Dataset ds = DATASETS.get(plan.dataset);

        FetchResult result = runQuery(plan, ds, visibleIds, !plan.ownerNames.isEmpty());
        // 负责人名全对不上时忽略筛选重试
        if (!plan.ownerNames.isEmpty() && result.rows().isEmpty()) {
            FetchResult retry = runQuery(plan, ds, visibleIds, false);
            if (!retry.rows().isEmpty()) {
                result = retry;
                plan.ownerNames = new ArrayList<>();
            }
        }
        return result;
    }

    private FetchResult runQuery(Plan plan, Dataset ds, List<String> visibleIds, boolean withOwners) {
        List<String> where = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (visibleIds != null) {
            if (visibleIds.isEmpty()) return new FetchResult(List.of(), List.of(), ""); // 哨兵：无任何可见数据
            where.add("`ownerId` IN (" + visibleIds.stream().map(x -> "?").collect(Collectors.joining(",")) + ")");
            params.addAll(visibleIds);
        }
        if (plan.recentMonths != null) {
            LocalDate cutoff = LocalDate.now(ZoneOffset.UTC).minusMonths(plan.recentMonths);
            where.add(ds.timeCutoffExpr() + " >= ?");
            params.add(cutoff.toString());
        }
        if (withOwners && !plan.ownerNames.isEmpty()) {
            where.add(plan.ownerNames.stream().map(n -> "`ownerName` LIKE ?").collect(Collectors.joining(" OR ")));
            for (String n : plan.ownerNames) params.add("%" + n + "%");
        }
        String whereSql = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);

        if (plan.dimension.equals(NONE_DIMENSION)) {
            Long cnt = jdbc.queryForObject(
                    "SELECT COUNT(*) AS cnt FROM `" + ds.table() + "`" + whereSql, Long.class, params.toArray());
            return new FetchResult(
                    List.of("指标", "数量"),
                    List.of(List.of(ds.label() + "总数", cnt == null ? 0L : cnt)),
                    "");
        }
        Dimension dim = ds.dimensions().get(plan.dimension);
        String sql = "SELECT COALESCE(NULLIF(TRIM(" + dim.expr() + "), ''), '未填写') AS dim, COUNT(*) AS cnt"
                + " FROM `" + ds.table() + "`" + whereSql
                + " GROUP BY dim ORDER BY cnt DESC, dim ASC LIMIT 50";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, params.toArray());
        List<List<Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Object dimVal = r.get("dim");
            Object cnt = r.get("cnt");
            out.add(List.of(dimVal == null ? "" : dimVal, cnt instanceof Number n ? n.longValue() : cnt));
        }
        return new FetchResult(List.of(dim.label(), "数量"), out, dim.label());
    }

    // ---- 结果构建：图表数据 + 总结 prompt ----

    public static Map<String, Object> buildChart(FetchResult data, Plan plan) {
        if (plan.dimension.equals(NONE_DIMENSION) || data.rows().isEmpty()) return null;
        Map<String, Object> chart = new LinkedHashMap<>();
        chart.put("type", plan.chartType);
        chart.put("title", plan.title);
        chart.put("categories", data.rows().stream().map(r -> r.get(0)).toList());
        chart.put("series", List.of(Map.of("name", "数量", "data", data.rows().stream().map(r -> r.get(1)).toList())));
        return chart;
    }

    public static String buildScopeNote(Plan plan, String dsLabel, String dimensionLabel, List<String> ownerNames) {
        StringBuilder note = new StringBuilder("数据集：" + dsLabel);
        note.append(dimensionLabel == null || dimensionLabel.isEmpty() ? " ｜ 统计：总数" : " ｜ 分组：" + dimensionLabel);
        if (plan.recentMonths != null) note.append(" ｜ 时间：最近 ").append(plan.recentMonths).append(" 个月");
        if (ownerNames != null && !ownerNames.isEmpty()) note.append(" ｜ 负责人：").append(String.join("、", ownerNames));
        note.append(" ｜ 仅统计您当前权限范围内的数据");
        return note.toString();
    }

    /** 复合计划的口径说明：合并各子分析视角 */
    public static String buildCombinedScopeNote(List<Plan> plans) {
        String perspectives = plans.stream()
                .map(p -> DATASETS.get(p.dataset).label() + "·" + p.title)
                .collect(Collectors.joining("、"));
        return "复合分析（" + plans.size() + " 个视角）：" + perspectives
                + " ｜ 仅统计您当前权限范围内的数据";
    }

    /** 单一结果总结（兼容入口，内部委托多结果版本） */
    public static List<Map<String, String>> buildSummaryMessages(String question, Plan plan,
                                                                 FetchResult data, String scopeNote) {
        return buildSummaryMessages(question, List.of(plan), List.of(data), scopeNote);
    }

    /**
     * 基于查询结果构建总结 prompt。多结果时引导模型给出结构化综合分析。
     */
    public static List<Map<String, String>> buildSummaryMessages(String question, List<Plan> plans,
                                                                 List<FetchResult> results, String scopeNote) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < plans.size(); i++) {
            Plan p = plans.get(i);
            FetchResult data = results.get(i);
            String tableText = data.rows().stream()
                    .map(r -> r.get(0) + "：" + r.get(1))
                    .collect(Collectors.joining("\n"));
            sb.append("【").append(p.title).append("】（")
                    .append(String.join("，", data.columns())).append("）：\n")
                    .append(tableText.isEmpty() ? "（无数据）" : tableText).append("\n\n");
        }
        boolean multi = plans.size() > 1;
        String systemPrompt = multi
                ? "你是 CRM 数据分析助手。请基于下面多个维度的统计结果，用简洁的中文做综合分析：先用 1-2 句给出总体结论，再分条列出 3-5 个关键发现（可引用具体数值，指出最高/最低/集中度/异常点），最后给 1-2 条简短的业务建议。不要编造数据以外的信息，不超过 400 字，不要输出 Markdown 标题，分条可用「1. 2. 3.」编号。"
                : "你是 CRM 数据分析助手。请基于下面的查询结果，用简洁的中文回答用户问题：先给结论，再点出 1-3 个关键特征（最高/最低/集中度等）。不要编造数据以外的信息，不超过 150 字，不要输出 Markdown 标题。";
        return List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content",
                        "用户问题：" + question + "\n\n统计口径：" + scopeNote + "\n\n查询结果：\n" + sb)
        );
    }
}
