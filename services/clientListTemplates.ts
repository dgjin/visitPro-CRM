import * as XLSX from 'xlsx';
import { Client, ClientType, Visit } from '../types';

// ==========================================
// 客户类别清单固定模板：按客户类型生成详细信息清单，并支持导出 Excel
// ==========================================

export interface ListColumn {
  label: string;
  /** 从客户对象取值，可附带该客户的拜访上下文，统一输出为字符串 */
  get: (c: Client, ctx?: VisitContext) => string;
}

/** 客户对应的拜访汇总：最近一次拜访与累计次数 */
export interface VisitContext {
  latest?: Visit;
  count: number;
}

export interface ClientListTemplate {
  id: string;
  clientType: ClientType;
  title: string;
  description: string;
  columns: ListColumn[];
}

const dash = (v?: string | number | null) => (v === undefined || v === null || String(v).trim() === '' ? '—' : String(v));

/** 拜访时间：格式化为 YYYY-MM-DD */
const visitDate = (v?: Visit) => {
  if (!v?.date) return '—';
  const d = new Date(v.date);
  return Number.isNaN(d.getTime()) ? dash(v.date) : d.toISOString().slice(0, 10);
};

/** 主要联系人：取第一位联系人的姓名（职务）与电话 */
const primaryContact = (c: Client) => {
  const p = c.contacts?.[0];
  if (!p) return '—';
  return p.role ? `${p.name}（${p.role}）` : p.name;
};
const primaryPhone = (c: Client) => dash(c.contacts?.[0]?.phone);

/** 拜访信息列：最近拜访人 / 时间与累计次数 */
const VISIT_COLUMNS: ListColumn[] = [
  { label: '最近拜访人', get: (_c, ctx) => dash(ctx?.latest?.ownerName || ctx?.latest?.ourParticipants) },
  { label: '最近拜访时间', get: (_c, ctx) => visitDate(ctx?.latest) },
  { label: '累计拜访次数', get: (_c, ctx) => String(ctx?.count ?? 0) },
];

/** 公共列：所有客户类型共用 */
const COMMON_COLUMNS: ListColumn[] = [
  { label: '客户名称', get: c => dash(c.name) },
  { label: '所属行业', get: c => dash(c.industry) },
  { label: '所在地区', get: c => dash(c.region) },
  { label: '负责人', get: c => dash(c.ownerName) },
  ...VISIT_COLUMNS,
  { label: '统一社会信用代码', get: c => dash(c.typeProfile?.creditCode) },
  { label: '成立时间', get: c => dash(c.typeProfile?.foundedDate) },
  { label: '主要联系人', get: primaryContact },
  { label: '联系电话', get: primaryPhone },
  { label: '协议签署', get: c => (c.typeProfile?.agreement?.signed ? '已签署' : '未签署') },
  { label: '协议签署主体', get: c => dash(c.typeProfile?.agreement?.party) },
  { label: '协议到期时间', get: c => dash(c.typeProfile?.agreement?.expireDate) },
  { label: '落地项目', get: c => (c.typeProfile?.project?.landed ? dash(c.typeProfile?.project?.projectName) : '无') },
  { label: '落地规模（万元）', get: c => (c.typeProfile?.project?.landed ? dash(c.typeProfile?.project?.scale) : '—') },
];

/** 三个固定模板：与客户类型一一对应，专属列贴合各类型的信息项 */
export const CLIENT_LIST_TEMPLATES: ClientListTemplate[] = [
  {
    id: 'gov',
    clientType: '地方政府',
    title: '地方政府客户清单',
    description: '按"地方政府"类别汇总客户详细信息，含行政级别、上报经营单位与协议项目情况',
    columns: [
      ...COMMON_COLUMNS.slice(0, 8),
      { label: '行政级别', get: c => dash(c.typeProfile?.adminLevel) },
      { label: '上报经营单位', get: c => dash(c.typeProfile?.reportingUnit) },
      ...COMMON_COLUMNS.slice(8),
    ],
  },
  {
    id: 'fin',
    clientType: '金融机构',
    title: '金融机构客户清单',
    description: '按"金融机构"类别汇总客户详细信息，含客户类别、细分类别与行业排名',
    columns: [
      ...COMMON_COLUMNS.slice(0, 8),
      { label: '上市代码', get: c => dash(c.typeProfile?.stockCode) },
      { label: '机构类别', get: c => dash(c.typeProfile?.finCategory) },
      { label: '细分类别', get: c => dash(c.typeProfile?.finSubCategory) },
      { label: '行业排名', get: c => dash(c.typeProfile?.finRank) },
      ...COMMON_COLUMNS.slice(8),
    ],
  },
  {
    id: 'ent',
    clientType: '产业客户',
    title: '产业客户清单',
    description: '按"产业客户"类别汇总客户详细信息，含所属集团、行业分类与主体评级',
    columns: [
      ...COMMON_COLUMNS.slice(0, 8),
      { label: '所属集团/单位', get: c => dash(c.typeProfile?.groupOwner) },
      { label: '客户类别', get: c => dash(c.typeProfile?.entCategory) },
      { label: '行业门类', get: c => dash(c.typeProfile?.industryCategory) },
      { label: '行业小类', get: c => dash(c.typeProfile?.industrySub) },
      { label: '主体评级', get: c => dash(c.typeProfile?.creditRating) },
      { label: '500强排名', get: c => dash(c.typeProfile?.top500Rank) },
      ...COMMON_COLUMNS.slice(8),
    ],
  },
];

/** 按模板过滤并排序客户（按名称稳定排序，便于导出对照） */
export function filterClientsByTemplate(clients: Client[], template: ClientListTemplate): Client[] {
  return clients
    .filter(c => c.clientType === template.clientType)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN'));
}

/** 按客户 ID 汇总拜访：最近一次拜访（按时间倒序）与累计次数 */
export function buildVisitContextMap(visits: Visit[]): Map<string, VisitContext> {
  const map = new Map<string, VisitContext>();
  for (const v of visits) {
    if (!v?.clientId) continue;
    const ctx = map.get(v.clientId);
    if (!ctx) {
      map.set(v.clientId, { latest: v, count: 1 });
    } else {
      ctx.count += 1;
      const latestTime = ctx.latest?.date ? new Date(ctx.latest.date).getTime() : 0;
      const curTime = v.date ? new Date(v.date).getTime() : 0;
      if (curTime > latestTime) ctx.latest = v;
    }
  }
  return map;
}

/** 将清单导出为 Excel：单个工作表，首行为字段名，自动列宽 */
export function exportTemplateToExcel(
  clients: Client[],
  template: ClientListTemplate,
  visitCtx?: Map<string, VisitContext>,
) {
  const headers = template.columns.map(col => col.label);
  const rows = clients.map(c => template.columns.map(col => col.get(c, visitCtx?.get(c.id))));

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // 按表头与内容长度估算列宽（中文按 2 个字符宽度计）
  const widthOf = (s: string) => Array.from(s).reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 2 : 1), 2);
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(40, Math.max(widthOf(h), ...rows.map(r => widthOf(String(r[i] ?? ''))))),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, template.clientType);

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${template.title}_${date}.xlsx`);
}
