import { describe, it, expect } from 'vitest';
import {
  CLIENT_LIST_TEMPLATES,
  filterClientsByTemplate,
  buildVisitContextMap,
} from '../clientListTemplates';
import type { Client, Visit } from '../../types';

const makeClient = (over: Partial<Client>): Client =>
  ({ id: over.id || 'c1', name: '测试客户', clientType: '地方政府', ...over } as Client);

const makeVisit = (over: Partial<Visit>): Visit =>
  ({ id: over.id || 'v1', clientId: 'c1', date: '2026-08-01', ...over } as Visit);

describe('CLIENT_LIST_TEMPLATES', () => {
  it('包含三个模板，分别对应三种客户类型', () => {
    expect(CLIENT_LIST_TEMPLATES).toHaveLength(3);
    const types = CLIENT_LIST_TEMPLATES.map(t => t.clientType).sort();
    expect(types).toEqual(['产业客户', '地方政府', '金融机构']);
  });

  it('每个模板均包含拜访信息列（最近拜访人/时间/次数）', () => {
    for (const t of CLIENT_LIST_TEMPLATES) {
      const labels = t.columns.map(c => c.label);
      expect(labels).toContain('最近拜访人');
      expect(labels).toContain('最近拜访时间');
      expect(labels).toContain('累计拜访次数');
    }
  });

  it('专属列插在公共列之间，不破坏公共列顺序', () => {
    for (const t of CLIENT_LIST_TEMPLATES) {
      const labels = t.columns.map(c => c.label);
      expect(labels.slice(0, 4)).toEqual(['客户名称', '所属行业', '所在地区', '负责人']);
      expect(labels).toContain('统一社会信用代码');
      expect(labels).toContain('落地项目');
    }
  });
});

describe('filterClientsByTemplate', () => {
  it('只保留模板对应类型的客户，并按名称排序', () => {
    const clients = [
      makeClient({ id: '1', name: '招商银行', clientType: '金融机构' }),
      makeClient({ id: '2', name: '杭州市政府', clientType: '地方政府' }),
      makeClient({ id: '3', name: '安徽省政府', clientType: '地方政府' }),
      makeClient({ id: '4', name: '宝武集团', clientType: '产业客户' }),
    ];
    const gov = CLIENT_LIST_TEMPLATES.find(t => t.clientType === '地方政府')!;
    const result = filterClientsByTemplate(clients, gov);
    // localeCompare zh-Hans-CN 按拼音序：安徽（an）在杭州（hang）之前
    expect(result.map(c => c.name)).toEqual(['安徽省政府', '杭州市政府']);
  });
});

describe('buildVisitContextMap', () => {
  it('按客户聚合拜访次数，latest 取时间最新的拜访', () => {
    const visits = [
      makeVisit({ id: 'v1', clientId: 'c1', date: '2026-07-01', ownerName: '张三' }),
      makeVisit({ id: 'v2', clientId: 'c1', date: '2026-08-01', ownerName: '李四' }),
      makeVisit({ id: 'v3', clientId: 'c2', date: '2026-07-15', ownerName: '王五' }),
    ];
    const map = buildVisitContextMap(visits);
    expect(map.size).toBe(2);
    expect(map.get('c1')?.count).toBe(2);
    expect(map.get('c1')?.latest?.ownerName).toBe('李四');
    expect(map.get('c2')?.count).toBe(1);
  });

  it('跳过无 clientId 的脏数据', () => {
    const visits = [makeVisit({ clientId: '' }), makeVisit({ clientId: undefined })];
    expect(buildVisitContextMap(visits as Visit[]).size).toBe(0);
  });
});

describe('拜访信息列取值', () => {
  const gov = CLIENT_LIST_TEMPLATES.find(t => t.clientType === '地方政府')!;
  const col = (label: string) => gov.columns.find(c => c.label === label)!;

  it('有拜访上下文时取最近拜访人与时间', () => {
    const client = makeClient({ id: 'c1' });
    const ctx = buildVisitContextMap([
      makeVisit({ clientId: 'c1', date: '2026-08-01T10:00:00Z', ownerName: '李四' }),
    ]);
    expect(col('最近拜访人').get(client, ctx.get('c1'))).toBe('李四');
    expect(col('最近拜访时间').get(client, ctx.get('c1'))).toBe('2026-08-01');
    expect(col('累计拜访次数').get(client, ctx.get('c1'))).toBe('1');
  });

  it('无拜访记录时次数为 0、其他显示占位符', () => {
    const client = makeClient({ id: 'c9' });
    expect(col('最近拜访人').get(client, undefined)).toBe('—');
    expect(col('最近拜访时间').get(client, undefined)).toBe('—');
    expect(col('累计拜访次数').get(client, undefined)).toBe('0');
  });
});
