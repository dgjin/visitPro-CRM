import React, { useState, useMemo } from 'react';
import { Search, UserCog, Users, CheckSquare, Square, Loader2, AlertCircle, User as UserIcon } from 'lucide-react';
import { Client, User } from '../types';
import { upsertClient } from '../services/apiService';

const ITEMS_PER_PAGE = 15;

interface ClientOwnerManagerProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  users?: User[];
}

/**
 * 客户负责人管理（组织管理，仅管理员可见）：
 * 支持搜索/筛选后单选或批量为客户指派负责人
 */
export const ClientOwnerManager: React.FC<ClientOwnerManagerProps> = ({ clients, setClients, users = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // ''=全部, '__none__'=未指派, 其余为用户 id
  const [ownerFilter, setOwnerFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetOwnerId, setTargetOwnerId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const sortedUsers = useMemo(() =>
    [...users]
      .filter(u => u.status !== 'inactive')
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN')),
    [users]);

  const teamOptions = useMemo(() =>
    Array.from(new Set(clients.map(c => c.team).filter(Boolean))).sort(), [clients]);
  const categoryOptions = useMemo(() =>
    Array.from(new Set(clients.map(c => c.listCategory).filter(Boolean))).sort(), [clients]);

  const filteredClients = useMemo(() => clients.filter(c => {
    if (teamFilter && c.team !== teamFilter) return false;
    if (categoryFilter && c.listCategory !== categoryFilter) return false;
    if (ownerFilter === '__none__' && c.ownerId) return false;
    if (ownerFilter && ownerFilter !== '__none__' && c.ownerId !== ownerFilter) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [c.name, c.industry, c.region, c.ownerName, c.team, c.listCategory]
      .some(v => (v || '').toLowerCase().includes(term));
  }), [clients, teamFilter, categoryFilter, ownerFilter, searchTerm]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = filteredClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const unassignedCount = clients.filter(c => !c.ownerId).length;

  const resetPage = () => setCurrentPage(1);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pageAllSelected = paginatedClients.length > 0 && paginatedClients.every(c => selectedIds.has(c.id));
  const togglePageAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (pageAllSelected) {
        paginatedClients.forEach(c => next.delete(c.id));
      } else {
        paginatedClients.forEach(c => next.add(c.id));
      }
      return next;
    });
  };

  /** 批量指派：逐个 upsert（仅变更负责人字段），部分失败不影响其余客户 */
  const handleBatchAssign = async () => {
    const target = sortedUsers.find(u => u.id === targetOwnerId);
    if (!target) { alert('请先选择要指派的负责人'); return; }
    if (selectedIds.size === 0) { alert('请先勾选需要指派负责人的客户'); return; }
    const targets = clients.filter(c => selectedIds.has(c.id));
    if (!confirm(`确定将 ${targets.length} 个客户的负责人指派为「${target.name}」吗？`)) return;

    setIsAssigning(true);
    setMessage(null);
    let ok = 0, fail = 0;
    for (const c of targets) {
      try {
        const updated = { ...c, ownerId: target.id, ownerName: target.name };
        await upsertClient(updated);
        setClients(prev => prev.map(x => x.id === c.id ? updated : x));
        ok++;
      } catch (e) {
        fail++;
      }
    }
    setIsAssigning(false);
    setSelectedIds(new Set());
    setMessage(fail === 0
      ? { type: 'success', text: `已成功将 ${ok} 个客户的负责人指派为「${target.name}」` }
      : { type: 'error', text: `指派完成：成功 ${ok} 个，失败 ${fail} 个` });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <UserCog className="w-5 h-5 text-[var(--primary-600)]" />
            客户负责人管理
          </h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            共 {clients.length} 个客户，其中 <span className="font-semibold text-[var(--primary-600)]">{unassignedCount}</span> 个尚未指派负责人
          </p>
        </div>
      </div>

      {/* 批量指派操作条 */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[var(--text-tertiary)]" />
          指派负责人
        </span>
        <select
          className="input py-2 text-sm w-40"
          value={targetOwnerId}
          onChange={e => setTargetOwnerId(e.target.value)}
          disabled={isAssigning}
        >
          <option value="">选择负责人…</option>
          {sortedUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <span className="text-xs text-[var(--text-tertiary)]">
          已勾选 <span className="font-semibold text-[var(--primary-600)]">{selectedIds.size}</span> 个客户
        </span>
        <button
          onClick={handleBatchAssign}
          disabled={isAssigning || !targetOwnerId || selectedIds.size === 0}
          className="btn btn-primary disabled:opacity-50"
        >
          {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
          {isAssigning ? '指派中…' : `批量指派（${selectedIds.size}）`}
        </button>
        {selectedIds.size > 0 && (
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[var(--text-tertiary)] hover:underline">
            清空勾选
          </button>
        )}
      </div>

      {message && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckSquare className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* 搜索与筛选 */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] w-4 h-4" />
          <input
            type="text"
            placeholder="搜索名称/行业/地区/负责人…"
            className="input pl-10 pr-4 py-2.5 text-sm w-64"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); resetPage(); }}
          />
        </div>
        <select className="input py-2.5 text-sm w-36" value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value); resetPage(); }}>
          <option value="">负责人：全部</option>
          <option value="__none__">未指派</option>
          {sortedUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="input py-2.5 text-sm w-36" value={teamFilter} onChange={e => { setTeamFilter(e.target.value); resetPage(); }}>
          <option value="">全部团队</option>
          {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input py-2.5 text-sm w-44" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); resetPage(); }}>
          <option value="">全部清单分类</option>
          {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {/* 客户列表 */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)] text-left text-xs font-semibold text-[var(--text-secondary)]">
              <th className="p-3 w-10">
                <button onClick={togglePageAll} title="勾选本页全部" className="text-[var(--text-tertiary)] hover:text-[var(--primary-600)]">
                  {pageAllSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="p-3">客户名称</th>
              <th className="p-3">客户类型</th>
              <th className="p-3">清单分类</th>
              <th className="p-3">所属团队</th>
              <th className="p-3">当前负责人</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClients.map(client => {
              const isSelected = selectedIds.has(client.id);
              return (
                <tr
                  key={client.id}
                  onClick={() => toggleSelect(client.id)}
                  className={`border-b border-[var(--border)] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[var(--primary-50,#EFF6FF)]' : 'hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleSelect(client.id)} className="text-[var(--text-tertiary)] hover:text-[var(--primary-600)]">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-[var(--primary-600)]" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="p-3 font-medium text-[var(--text-primary)]">{client.name}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{client.clientType || '—'}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{client.listCategory || '—'}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{client.team || '—'}</td>
                  <td className="p-3">
                    {client.ownerName ? (
                      <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <UserIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        {client.ownerName}
                      </span>
                    ) : (
                      <span className="badge-warning text-xs">未指派</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {paginatedClients.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[var(--text-tertiary)]">没有符合条件的客户</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 分页 */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--border)] text-sm text-[var(--text-secondary)]">
          <span>共 {filteredClients.length} 个客户</span>
          <div className="flex items-center gap-2">
            <button className="btn py-1.5 px-3 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一页</button>
            <span className="text-xs">{currentPage} / {Math.max(totalPages, 1)}</span>
            <button className="btn py-1.5 px-3 text-xs" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一页</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientOwnerManager;
