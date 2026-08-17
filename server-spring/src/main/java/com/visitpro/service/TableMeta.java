package com.visitpro.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 表元数据：列白名单 / JSON 列 / 日期列；写入前 prepareRow、读取后 mapRow。
 * 对齐 Node 版 core.js 的 TABLES/prepareRow/mapRow 语义。
 */
public final class TableMeta {
    public record Meta(List<String> columns, Set<String> json, Set<String> dates) {}

    public static final Map<String, Meta> TABLES = Map.of(
            "roles", new Meta(
                    List.of("id", "name", "description", "created_at"),
                    Set.of(), Set.of("created_at")),
            "departments", new Meta(
                    List.of("id", "name", "parentId", "managerId", "created_at"),
                    Set.of(), Set.of("created_at")),
            "users", new Meta(
                    List.of("id", "name", "email", "phone", "avatarUrl", "roleId", "departmentId", "status",
                            "customFields", "theme_preference", "last_login_at", "created_at"),
                    Set.of("customFields"), Set.of("last_login_at", "created_at")),
            "clients", new Meta(
                    List.of("id", "name", "industry", "status", "clientType", "region", "isKeyAccount", "team", "listCategory", "isNewClient", "contacts", "customFields",
                            "typeProfile", "ownerId", "ownerName", "equityStructure", "subsidiaries",
                            "financialAnalysis", "supplyChainInfo", "tags", "created_at"),
                    Set.of("contacts", "customFields", "typeProfile", "equityStructure", "subsidiaries", "tags"),
                    Set.of("created_at")),
            "visits", new Meta(
                    List.of("id", "clientId", "clientName", "date", "content", "type", "ownerId", "ownerName",
                            "location", "clientContact", "clientContactRole", "clientParticipants",
                            "ourParticipants", "recordingData", "recordings", "customFields", "summary",
                            "sentiment", "actionItems", "followUpDraft", "created_at"),
                    Set.of("customFields", "actionItems", "recordings"), // recordings 为 LONGTEXT，读出后解析
                    Set.of("created_at"))
    );

    /** JSON 列空值归一化默认值（对齐前端默认值） */
    private static final Map<String, Object> JSON_DEFAULTS = Map.of(
            "customFields", Map.of(),
            "contacts", List.of(),
            "typeProfile", Map.of(),
            "equityStructure", List.of(),
            "subsidiaries", List.of(),
            "tags", List.of(),
            "actionItems", List.of(),
            "recordings", List.of()
    );

    private static final ObjectMapper OM = new ObjectMapper();
    private static final DateTimeFormatter MYSQL_DT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    private TableMeta() {}

    public static Meta of(String table) {
        return TABLES.get(table);
    }

    /** DATETIME 列读出后为 LocalDateTime（连接串 serverTimezone=UTC，即 UTC 时间） */
    private static Instant toInstant(Object v) {
        if (v instanceof Instant i) return i;
        if (v instanceof LocalDateTime ldt) return ldt.toInstant(ZoneOffset.UTC);
        if (v instanceof java.sql.Timestamp ts) return ts.toInstant();
        return null;
    }

    /** 任意可解析值 -> 'yyyy-MM-dd HH:mm:ss'（UTC），对齐 Node toMySqlDatetime */
    public static String toMySqlDatetime(Object value) {
        if (value == null) return null;
        try {
            Instant instant = toInstant(value);
            if (instant == null) instant = Instant.parse(value.toString());
            return MYSQL_DT.format(instant.truncatedTo(ChronoUnit.SECONDS));
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 写入前：过滤列白名单 + 序列化 JSON/日期列。返回 LinkedHashMap 保持列序。 */
    public static Map<String, Object> prepareRow(String table, Map<String, Object> body) {
        Meta meta = TABLES.get(table);
        Map<String, Object> row = new LinkedHashMap<>();
        for (String col : meta.columns()) {
            if (col.equals("created_at")) continue; // 由数据库默认值生成
            if (!body.containsKey(col)) continue;
            Object value = body.get(col);
            if (meta.json().contains(col)) {
                try {
                    value = value == null ? null : OM.writeValueAsString(value);
                } catch (Exception e) {
                    value = null;
                }
            } else if (meta.dates().contains(col)) {
                value = toMySqlDatetime(value);
            }
            row.put(col, value);
        }
        return row;
    }

    /** 读取后：剔除密码、日期列转 ISO 字符串、JSON 列解析并归一化默认值 */
    public static Map<String, Object> mapRow(String table, Map<String, Object> row) {
        Meta meta = TABLES.get(table);
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.remove("password"); // 密码哈希永不下发
        for (String col : meta.dates()) {
            Instant instant = toInstant(out.get(col));
            if (instant != null) out.put(col, instant.toString());
        }
        for (String col : meta.json()) {
            Object v = out.get(col);
            if (v instanceof String s) {
                try {
                    v = OM.readValue(s, new TypeReference<Object>() {});
                } catch (Exception e) {
                    v = JSON_DEFAULTS.get(col);
                }
            }
            if (v == null) v = JSON_DEFAULTS.get(col);
            out.put(col, v);
        }
        return out;
    }

    /** visits 列表列（排除录音大字段） */
    public static List<String> visitListColumns() {
        List<String> cols = new ArrayList<>();
        for (String c : TABLES.get("visits").columns()) {
            if (!c.equals("recordingData")) cols.add(c);
        }
        return cols;
    }
}
