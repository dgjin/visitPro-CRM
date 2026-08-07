import React, { useState, useEffect } from 'react';
import { Visit, Sentiment, User } from '../types';
import { 
  Calendar,
  ChevronRight,
  ChevronLeft,
  CheckSquare,
  User as UserIcon,
  Search,
  Trash2,
  Volume2,
  Video,
  Phone,
  Filter,
  XCircle,
  Eye,
  Plus,
  Building2
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const BuildingIcon = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
    <path d="M9 22v-4h6v4"/>
    <path d="M8 6h.01"/>
    <path d="M16 6h.01"/>
    <path d="M12 6h.01"/>
    <path d="M12 10h.01"/>
    <path d="M12 14h.01"/>
    <path d="M16 10h.01"/>
    <path d="M16 14h.01"/>
    <path d="M8 10h.01"/>
    <path d="M8 14h.01"/>
  </svg>
);

export const getSentimentDotClass = (sentiment?: Sentiment) => {
    switch (sentiment) {
      case Sentiment.Positive: return 'status-dot-success';
      case Sentiment.Negative: return 'status-dot-danger';
      default: return 'status-dot';
    }
};

interface VisitListViewProps {
  visits: Visit[];
  currentUser: User;
  initialSearchTerm?: string;
  onOpenVisit: (visit: Visit) => void;
  onNewVisit: () => void;
  onDeleteVisit: (id: string, e?: React.MouseEvent) => void;
}

const VisitListView: React.FC<VisitListViewProps> = ({ 
  visits, 
  currentUser,
  initialSearchTerm,
  onOpenVisit,
  onNewVisit,
  onDeleteVisit
}) => {
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Handle Initial Search Term (Voice Command)
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setListSearchTerm(initialSearchTerm);
      if (initialSearchTerm) {
        setCurrentPage(1);
      }
    }
  }, [initialSearchTerm]);

  // Permission Logic
  const canEdit = (visit: Partial<Visit>) => {
      if (!visit.id) return true;
      if (currentUser?.role === '管理员') return true;
      if (visit.ownerId && currentUser?.id === visit.ownerId) return true;
      return false;
  };

  const filteredVisits = visits.filter(v => {
      const searchLower = listSearchTerm.toLowerCase();
      const matchSearch = 
        (v.clientName || '').toLowerCase().includes(searchLower) || 
        (v.content || '').toLowerCase().includes(searchLower) ||
        (v.summary || '').toLowerCase().includes(searchLower) ||
        (v.ownerName || '').toLowerCase().includes(searchLower) ||
        (v.location || '').toLowerCase().includes(searchLower) ||
        (v.clientParticipants || '').toLowerCase().includes(searchLower) ||
        (v.clientContact || '').toLowerCase().includes(searchLower);
      
      const matchType = filterType === 'ALL' || v.type === filterType;
      
      let matchDate = true;
      if (startDate) {
          matchDate = matchDate && new Date(v.date) >= new Date(startDate);
      }
      if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchDate = matchDate && new Date(v.date) <= end;
      }
      
      return matchSearch && matchType && matchDate;
  });

  const totalPages = Math.ceil(filteredVisits.length / ITEMS_PER_PAGE);
  const paginatedVisits = filteredVisits.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case '线上会议': return <Video className="w-4 h-4" style={{ color: 'var(--primary-500)' }} />;
      case '电话沟通': return <Phone className="w-4 h-4" style={{ color: 'var(--success)' }} />;
      case '客户到访': return <BuildingIcon className="w-4 h-4" style={{ color: 'var(--warning)' }} />;
      default: return <UserIcon className="w-4 h-4" style={{ color: 'var(--info)' }} />;
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case '线上会议': return { background: 'var(--primary-50)', color: 'var(--primary-700)' };
      case '电话沟通': return { background: 'var(--success-light)', color: '#065f46' };
      case '客户到访': return { background: 'var(--warning-light)', color: '#92400e' };
      default: return { background: 'var(--info-light)', color: '#5b21b6' };
    }
  };
    return (
      <div className="h-full flex flex-col animate-fade-in-up">
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: 700, 
              color: 'var(--text-primary)',
              marginBottom: '4px'
            }}>拜访历史</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              共 {filteredVisits.length} 条拜访记录
            </p>
          </div>
          <button 
            onClick={onNewVisit}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            新建拜访
          </button>
        </div>

        {/* Compact Filter Section */}
        <div style={{ 
          background: 'var(--bg-primary)', 
          padding: '16px 20px', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
              <Search style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-tertiary)', 
                width: '16px', 
                height: '16px' 
              }} />
              <input 
                type="text"
                placeholder="搜索客户、内容、人员..."
                className="input"
                style={{ paddingLeft: '40px' }}
                value={listSearchTerm}
                onChange={e => { setListSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
            
            {/* Type Filter */}
            <div style={{ position: 'relative' }}>
              <Filter style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-tertiary)', 
                width: '16px', 
                height: '16px',
                pointerEvents: 'none'
              }} />
              <select
                style={{ 
                  padding: '10px 14px 10px 40px', 
                  fontSize: '14px', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius)', 
                  background: 'var(--bg-primary)', 
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none',
                  minWidth: '140px'
                }}
                value={filterType}
                onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">所有类型</option>
                <option value="线下拜访">线下拜访</option>
                <option value="线上会议">线上会议</option>
                <option value="电话沟通">电话沟通</option>
                <option value="客户到访">客户到访</option>
              </select>
            </div>

            {/* Date Range */}
            <input 
              type="date"
              className="input"
              style={{ width: 'auto', minWidth: '140px' }}
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }}
              title="开始日期"
            />
            <span style={{ color: 'var(--text-tertiary)' }}>至</span>
            <input 
              type="date"
              className="input"
              style={{ width: 'auto', minWidth: '140px' }}
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }}
              title="结束日期"
            />
            
            {(startDate || endDate || listSearchTerm || filterType !== 'ALL') && (
              <button 
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setListSearchTerm('');
                  setFilterType('ALL');
                  setCurrentPage(1);
                }}
                style={{ 
                  padding: '10px', 
                  color: 'var(--text-tertiary)', 
                  borderRadius: 'var(--radius)',
                  transition: 'all var(--transition-fast)'
                }}
                className="btn-ghost"
                title="重置筛选"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Card-based List */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          padding: '4px'
        }}>
          {paginatedVisits.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '80px 20px', 
              color: 'var(--text-tertiary)',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border)'
            }}>
              <Calendar style={{ width: '64px', height: '64px', margin: '0 auto 16px', opacity: 0.3 }} />
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>暂无符合条件的拜访记录</p>
              <p style={{ fontSize: '14px' }}>点击右上角按钮创建新拜访</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {paginatedVisits.map((visit) => {
                const canEditVisit = canEdit(visit);
                const dateObj = new Date(visit.date);
                const day = dateObj.getDate();
                const month = dateObj.getMonth() + 1;
                const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const badgeStyle = getTypeBadgeStyle(visit.type);

                return (
                  <div 
                    key={visit.id}
                    onClick={() => onOpenVisit(visit)}
                    style={{ 
                      background: 'var(--bg-primary)', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-light)',
                      boxShadow: 'var(--shadow-sm)',
                      padding: '20px',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start'
                    }}
                    className="card-interactive"
                  >
                    {/* Date Column */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      minWidth: '60px',
                      padding: '8px 12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius)'
                    }}>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{day}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{month}月</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{time}</span>
                    </div>

                    {/* Content Column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Header Row */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        marginBottom: '8px',
                        flexWrap: 'wrap'
                      }}>
                        <h3 style={{ 
                          fontSize: '16px', 
                          fontWeight: 600, 
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <Building2 className="w-4 h-4" style={{ color: 'var(--primary-500)' }} />
                          {visit.clientName}
                        </h3>
                        
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          padding: '4px 10px', 
                          fontSize: '12px', 
                          fontWeight: 500, 
                          borderRadius: 'var(--radius-full)',
                          ...badgeStyle
                        }}>
                          {getTypeIcon(visit.type)}
                          {visit.type}
                        </span>
                        
                        {visit.sentiment && (
                          <span 
                            className={getSentimentDotClass(visit.sentiment)}
                            title={`情感倾向: ${visit.sentiment}`}
                            style={{ 
                              background: visit.sentiment === Sentiment.Positive ? 'var(--success)' : 
                                         visit.sentiment === Sentiment.Negative ? 'var(--danger)' : 'var(--text-tertiary)'
                            }}
                          />
                        )}
                      </div>

                      {/* Summary */}
                      <p style={{ 
                        fontSize: '14px', 
                        color: 'var(--text-secondary)', 
                        lineHeight: 1.6,
                        marginBottom: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {visit.summary || visit.content?.replace(/<[^>]+>/g, '') || 
                          <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>暂无内容</span>
                        }
                      </p>

                      {/* Footer Row */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '16px',
                        flexWrap: 'wrap'
                      }}>
                        {/* Owner */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          fontSize: '13px',
                          color: 'var(--text-tertiary)'
                        }}>
                          <UserIcon className="w-3.5 h-3.5" />
                          {visit.ownerName || 'Unknown'}
                        </div>

                        {/* Recordings */}
                        {(visit.recordings?.length ?? 0) > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            fontSize: '13px',
                            color: 'var(--primary-600)',
                            background: 'var(--primary-50)',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)'
                          }}>
                            <Volume2 className="w-3.5 h-3.5" />
                            {visit.recordings?.length} 录音
                          </div>
                        )}

                        {/* Action Items */}
                        {visit.actionItems && visit.actionItems.length > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            fontSize: '13px',
                            color: '#92400e',
                            background: 'var(--warning-light)',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)'
                          }}>
                            <CheckSquare className="w-3.5 h-3.5" />
                            {visit.actionItems.length} 待办
                          </div>
                        )}

                        {/* Read-only indicator */}
                        {!canEditVisit && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            fontSize: '13px',
                            color: 'var(--text-tertiary)',
                            marginLeft: 'auto'
                          }}>
                            <Eye className="w-3.5 h-3.5" />
                            只读
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {canEditVisit && (
                      <button
                        onClick={(e) => onDeleteVisit(visit.id, e)}
                        style={{ 
                          padding: '8px', 
                          color: 'var(--text-tertiary)', 
                          borderRadius: 'var(--radius)',
                          opacity: 0,
                          transition: 'all var(--transition-fast)'
                        }}
                        className="btn-danger"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.background = 'var(--danger-light)';
                          e.currentTarget.style.color = 'var(--danger)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0';
                        }}
                        title="删除记录"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredVisits.length > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '16px 0',
            marginTop: '8px',
            borderTop: '1px solid var(--border-light)'
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              显示 {Math.min(filteredVisits.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} - {Math.min(filteredVisits.length, currentPage * ITEMS_PER_PAGE)} 共 {filteredVisits.length} 条
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ 
                  padding: '8px', 
                  borderRadius: 'var(--radius)', 
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  transition: 'all var(--transition-fast)'
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span style={{ 
                fontSize: '14px', 
                display: 'flex', 
                alignItems: 'center', 
                padding: '0 12px',
                fontWeight: 500,
                color: 'var(--text-primary)'
              }}>
                {currentPage} / {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ 
                  padding: '8px', 
                  borderRadius: 'var(--radius)', 
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  transition: 'all var(--transition-fast)'
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
};

export default VisitListView;
