import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  ArrowRight, 
  Trophy,
  User as UserIcon,
  X,
  ChevronRight,
  Building2,
  Network,
  Zap,
  MapPin,
  CalendarPlus,
  Loader2,
  Sparkles,
  Clock,
  Activity
} from 'lucide-react';
import { Visit, Client, User, Department, Sentiment } from '../types';

interface DashboardProps {
  visits: Visit[];
  clients: Client[];
  users?: User[];
  departments?: Department[];
  currentUser: User;
  onNavigate: (view: any) => void;
  onViewVisit?: (visitId: string) => void;
  onCheckIn?: (visitData: Partial<Visit>) => void;
}

type RankingDimension = 'USER' | 'INSTITUTION' | 'TEAM';

export const Dashboard: React.FC<DashboardProps> = ({ 
  visits, 
  clients, 
  users = [], 
  departments = [], 
  currentUser,
  onNavigate, 
  onViewVisit, 
  onCheckIn 
}) => {
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [rankingDimension, setRankingDimension] = useState<RankingDimension>('USER');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Calculated Stats
  const totalClients = clients.length;
  const industryCount = new Set(clients.map(c => c.industry).filter(Boolean)).size;
  const myClientCount = clients.filter(c => c.ownerId === currentUser.id).length;
  
  const visitsThisMonth = visits.length; // Simplified for demo
  const todoCount = visits.filter(v => v.actionItems && v.actionItems.length > 0).length;

  // Smart Check-In Logic
  const handleSmartCheckIn = () => {
      setIsCheckingIn(true);
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
              // Simulate finding nearest client logic
              // In real app, we would calculate distance using position.coords.latitude/longitude
              // Here we just pick a random client to simulate "Match"
              setTimeout(() => {
                  // Prioritize filtering clients owned by user for check-in suggestion
                  const myClients = clients.filter(c => c.ownerId === currentUser.id);
                  const pool = myClients.length > 0 ? myClients : clients;
                  const randomClient = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
                  
                  const now = new Date();
                  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                  const formattedDate = now.toISOString().slice(0, 16);
                  
                  if (onCheckIn) {
                      onCheckIn({
                          clientId: randomClient?.id,
                          clientName: randomClient?.name,
                          location: randomClient?.region || "当前位置 (自动定位)",
                          date: formattedDate,
                          type: '线下拜访',
                          content: `[智能签到] 已到达客户现场。\n时间：${new Date().toLocaleTimeString()}\n`
                      });
                  }
                  setIsCheckingIn(false);
              }, 1500); // Fake delay for UX
          }, (err) => {
              alert("无法获取位置信息，将直接打开新建页面。");
              if (onCheckIn) onCheckIn({});
              setIsCheckingIn(false);
          });
      } else {
          alert("您的浏览器不支持地理位置功能。");
          if (onCheckIn) onCheckIn({});
          setIsCheckingIn(false);
      }
  };

  // AI Next Best Action Logic (Personalized)
  const suggestedActions = useMemo(() => {
      const actions: { 
          id: string; 
          title: string; 
          desc: string; 
          type: 'URGENT' | 'OPPORTUNITY' | 'ROUTINE'; 
          clientName: string; 
          clientId?: string;
          visitId?: string;
      }[] = [];
      
      // 1. Filter data based on Current User Permissions
      const myVisits = visits.filter(v => v.ownerId === currentUser.id);

      // Rule 1: Open Action Items (Urgent)
      // Sort by date desc to see most recent tasks
      const visitsWithActions = myVisits
          .filter(v => v.actionItems && v.actionItems.length > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      visitsWithActions.slice(0, 3).forEach(v => {
          if (v.actionItems && v.actionItems.length > 0) {
              actions.push({
                  id: `todo_${v.id}`,
                  title: '待办提醒',
                  desc: `待办：${v.actionItems[0]} (来源: ${new Date(v.date).toLocaleDateString()} 拜访)`,
                  type: 'URGENT',
                  clientName: v.clientName,
                  clientId: v.clientId,
                  visitId: v.id
              });
          }
      });

      // Rule 2: Positive sentiment but no recent follow up (Opportunity)
      const positiveVisits = myVisits
          .filter(v => v.sentiment === Sentiment.Positive)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      positiveVisits.slice(0, 2).forEach(v => {
          // Avoid duplicates if already added as todo
          if (!actions.some(a => a.visitId === v.id)) {
              actions.push({
                  id: `act_${v.id}`,
                  title: '乘胜追击',
                  desc: `客户 ${v.clientName} 意向积极，建议尽快安排下次回访或发送方案。`,
                  type: 'OPPORTUNITY',
                  clientName: v.clientName,
                  clientId: v.clientId,
                  visitId: v.id
              });
          }
      });

      // Sort: Urgent first
      actions.sort((a, b) => (a.type === 'URGENT' ? -1 : 1));

      return actions.slice(0, 3); // Top 3 suggestions
  }, [visits, clients, currentUser.id]);

  // Helper to get Department Path [Root, Child, Grandchild]
  const getDeptPath = (deptId: string | undefined): Department[] => {
    if (!deptId || departments.length === 0) return [];
    const path: Department[] = [];
    let current = departments.find(d => d.id === deptId);
    let guard = 0;
    while (current && guard < 10) { // Safety guard against cycles
        path.unshift(current);
        current = departments.find(d => d.id === current?.parentId);
        guard++;
    }
    return path;
  };

  // Aggregation Logic
  const statsData = useMemo(() => {
    const map = new Map<string, { name: string; count: number; id: string }>();

    visits.forEach(v => {
        let key = '';
        let name = '';

        if (rankingDimension === 'USER') {
             key = v.ownerId || v.ownerName || 'unknown';
             name = v.ownerName || '未知用户';
        } else {
             // Logic for Organization dimensions
             const owner = users.find(u => u.id === v.ownerId);
             const path = getDeptPath(owner?.departmentId);

             if (rankingDimension === 'INSTITUTION') {
                 // Target: Level 2 Department (Index 1)
                 if (path.length > 1) {
                     key = path[1].id;
                     name = path[1].name;
                 } else if (path.length > 0) {
                     const last = path[path.length - 1];
                     key = last.id;
                     name = last.name;
                 } else {
                     key = 'unknown_inst';
                     name = '未知机构';
                 }
             } else if (rankingDimension === 'TEAM') {
                 // Target: Level 2 - Level 3 - Level 4
                 if (path.length > 1) {
                     const relevantParts = path.slice(1, 4); 
                     key = relevantParts.map(d => d.id).join('_');
                     name = relevantParts.map(d => d.name).join(' - ');
                 } else if (path.length > 0) {
                     const last = path[path.length - 1];
                     key = last.id;
                     name = last.name;
                 } else {
                     key = 'unknown_team';
                     name = '未知团队';
                 }
             }
        }

        if (!map.has(key)) {
            map.set(key, { name, count: 0, id: key });
        }
        map.get(key)!.count++;
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [visits, users, departments, rankingDimension]);

  const topStats = statsData.slice(0, 10);
  const maxCount = statsData.length > 0 ? statsData[0].count : 0;

  const activityData = [
    { name: '周一', visits: 4 },
    { name: '周二', visits: 7 },
    { name: '周三', visits: 5 },
    { name: '周四', visits: 9 },
    { name: '周五', visits: 6 },
    { name: '周六', visits: 2 },
    { name: '周日', visits: 0 },
  ];

  // Modern Stat Card with gradient icon background
  const StatCard = ({ title, value, subtext, icon: Icon, gradient }: any) => (
    <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }} className="group hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>{title}</p>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>{value}</h3>
          {subtext && (
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 500, color: subtext.includes('+') ? 'var(--success-500)' : 'var(--text-tertiary)' }}>
              {subtext.includes('+') && <span className="inline-flex items-center mr-1">
                <TrendingUp className="w-3 h-3 mr-0.5" />
              </span>}
              {subtext}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 ${gradient}`} style={{ borderRadius: 'var(--radius-md)' }}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg-secondary)', minHeight: '100vh', padding: '1.5rem' }} className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>仪表盘</h1>
            <span style={{ padding: '0.125rem 0.625rem', background: 'var(--primary-100)', color: 'var(--primary-700)', fontSize: '0.75rem', fontWeight: 600, borderRadius: '9999px' }}>
              Pro
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }} className="flex items-center gap-2">
            <Sparkles style={{ color: 'var(--warning-500)' }} className="w-4 h-4" />
            欢迎回来，{currentUser.name}！查看您的客户拜访记录概览
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div style={{ background: 'var(--bg-primary)', padding: '0.5rem 1rem', borderRadius: '9999px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }} className="flex items-center gap-3">
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '9999px', background: 'linear-gradient(to bottom right, var(--primary-700), var(--primary-500))' }} className="flex items-center justify-center text-white font-semibold text-sm shadow-md">
              {currentUser.name.substring(0, 1)}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{currentUser.name}</span>
          </div>
        </div>
      </div>

      {/* Mobile Smart Check-in Header (Visible mostly on mobile) */}
      <div className="md:hidden mb-6">
        <button 
          onClick={handleSmartCheckIn}
          disabled={isCheckingIn}
          style={{ width: '100%', background: 'linear-gradient(to right, var(--primary-800), var(--primary-700), var(--primary-500))', color: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)' }}
          className="flex items-center justify-center font-bold text-lg active:scale-[0.98] transition-all"
        >
          {isCheckingIn ? <Loader2 className="w-6 h-6 animate-spin mr-2"/> : <MapPin className="w-6 h-6 mr-2 animate-bounce" />}
          {isCheckingIn ? '定位匹配中...' : '到达签到'}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard 
          title="客户总数" 
          value={totalClients} 
          subtext={`覆盖 ${industryCount} 个行业`}
          icon={Users} 
          gradient="bg-gradient-to-br from-[#1E40AF] to-[#3B82F6]" 
        />
        <StatCard 
          title="本月拜访" 
          value={visitsThisMonth} 
          subtext="环比上月 +12%" 
          icon={Activity} 
          gradient="bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA]" 
        />
        <StatCard 
          title="待办事项" 
          value={todoCount} 
          subtext="来自拜访记录" 
          icon={CheckCircle} 
          gradient="bg-gradient-to-br from-[#10B981] to-[#34D399]" 
        />
        <StatCard 
          title="我负责的客户" 
          value={myClientCount} 
          subtext="当前用户名下" 
          icon={UserIcon} 
          gradient="bg-gradient-to-br from-[#0EA5E9] to-[#38BDF8]" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* AI Suggested Actions - Enhanced Visual Design */}
            {suggestedActions.length > 0 && (
                <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }} className="relative overflow-hidden">
                  {/* Decorative gradient border top */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1E40AF] via-[#8B5CF6] to-[#3B82F6]" />
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)', background: 'linear-gradient(to bottom right, var(--primary-700), var(--primary-500))' }} className="flex items-center justify-center shadow-lg">
                        <Zap className="w-5 h-5 text-white fill-current" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI 智能建议</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>基于您的数据生成的个性化建议</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                        {suggestedActions.map((action, index) => (
                            <div 
                              key={action.id} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                padding: '1rem', 
                                borderRadius: 'var(--radius-md)', 
                                border: `1px solid ${action.type === 'URGENT' ? 'var(--error-300)' : 'var(--success-300)'}`,
                                background: action.type === 'URGENT' ? 'linear-gradient(to right, var(--error-50), var(--bg-primary))' : 'linear-gradient(to right, var(--success-50), var(--bg-primary))'
                              }}
                              className="transition-all duration-200 hover:shadow-md group"
                            >
                                <div style={{ 
                                  width: '2.5rem', 
                                  height: '2.5rem', 
                                  borderRadius: 'var(--radius-sm)', 
                                  marginRight: '1rem', 
                                  flexShrink: 0, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  boxShadow: 'var(--shadow-sm)',
                                  background: action.type === 'URGENT' ? 'linear-gradient(to bottom right, var(--error-500), var(--error-400))' : 'linear-gradient(to bottom right, var(--success-500), var(--success-400))'
                                }}>
                                    {action.type === 'URGENT' ? <AlertTriangle className="w-5 h-5 text-white" /> : <TrendingUp className="w-5 h-5 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex items-center gap-2">
                                          <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{action.title}</h4>
                                          <span style={{ 
                                            padding: '0.125rem 0.5rem', 
                                            fontSize: '0.625rem', 
                                            fontWeight: 700, 
                                            borderRadius: '9999px',
                                            background: action.type === 'URGENT' ? 'var(--error-100)' : 'var(--success-100)',
                                            color: action.type === 'URGENT' ? 'var(--error-600)' : 'var(--success-600)'
                                          }}>
                                            {action.type === 'URGENT' ? '紧急' : '机会'}
                                          </span>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if (action.id.startsWith('todo') && action.visitId) {
                                                    onViewVisit && onViewVisit(action.visitId);
                                                } else if (onCheckIn && action.clientId) {
                                                    onCheckIn({
                                                        clientId: action.clientId,
                                                        clientName: action.clientName,
                                                        type: '线下拜访',
                                                        content: action.type === 'OPPORTUNITY' 
                                                            ? `[AI 建议回访] 跟进之前积极的互动。` 
                                                            : `[AI 建议关怀] 客户流失风险预警回访。`
                                                    });
                                                } else {
                                                    onNavigate('VISITS');
                                                }
                                            }}
                                            style={{ 
                                              flexShrink: 0, 
                                              fontSize: '0.75rem', 
                                              background: 'var(--primary-700)', 
                                              color: 'white', 
                                              padding: '0.375rem 1rem', 
                                              borderRadius: 'var(--radius-sm)', 
                                              fontWeight: 500 
                                            }}
                                            className="hover:shadow-md active:scale-95 transition-all"
                                        >
                                            执行
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.625 }}>{action.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                  </div>
                </div>
            )}

            {/* Activity Chart - Modern Design */}
            <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)', background: 'rgba(30, 64, 175, 0.1)' }} className="flex items-center justify-center">
                        <Activity style={{ color: 'var(--primary-700)' }} className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>每周活动趋势</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>过去7天的拜访活动统计</p>
                      </div>
                    </div>
                    <select style={{ fontSize: '0.875rem', border: '1px solid var(--border)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem', color: 'var(--text-primary)' }} className="focus:outline-none focus:ring-2 focus:ring-[var(--primary-700)] focus:border-transparent transition-all">
                      <option>本周</option>
                      <option>上周</option>
                    </select>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                        <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                        dy={10}
                        />
                        <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                        />
                        <Tooltip 
                        cursor={{ fill: 'var(--bg-secondary)' }}
                        contentStyle={{ 
                          borderRadius: 'var(--radius-md)', 
                          border: '1px solid var(--border)', 
                          boxShadow: 'var(--shadow-lg)',
                          padding: '12px',
                          background: 'var(--bg-primary)'
                        }}
                        />
                        <Bar dataKey="visits" radius={[8, 8, 0, 0]} barSize={32}>
                        {activityData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={index === 3 ? 'var(--primary-700)' : 'var(--primary-300)'}
                              className="transition-all duration-300 hover:opacity-80"
                            />
                        ))}
                        </Bar>
                    </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Visit Stats / Ranking - Enhanced List Design */}
            <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.1)' }} className="flex items-center justify-center">
                        <Trophy style={{ color: 'var(--warning-500)' }} className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rankingDimension === 'USER' ? '个人' : rankingDimension === 'INSTITUTION' ? '机构' : '团队'}拜访排行
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>实时更新的拜访数据统计</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div style={{ background: 'var(--bg-secondary)' }} className="flex items-center space-x-1 p-1 rounded-xl">
                          <button 
                              onClick={() => setRankingDimension('USER')}
                              style={{ 
                                padding: '0.375rem 1rem', 
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                borderRadius: 'var(--radius-sm)',
                                background: rankingDimension === 'USER' ? 'var(--bg-primary)' : 'transparent',
                                color: rankingDimension === 'USER' ? 'var(--primary-700)' : 'var(--text-secondary)',
                                boxShadow: rankingDimension === 'USER' ? 'var(--shadow-sm)' : 'none'
                              }}
                              className="transition-all hover:text-[var(--text-primary)]"
                          >
                              人员
                          </button>
                          <button 
                              onClick={() => setRankingDimension('INSTITUTION')}
                              style={{ 
                                padding: '0.375rem 1rem', 
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                borderRadius: 'var(--radius-sm)',
                                background: rankingDimension === 'INSTITUTION' ? 'var(--bg-primary)' : 'transparent',
                                color: rankingDimension === 'INSTITUTION' ? 'var(--primary-700)' : 'var(--text-secondary)',
                                boxShadow: rankingDimension === 'INSTITUTION' ? 'var(--shadow-sm)' : 'none'
                              }}
                              className="transition-all hover:text-[var(--text-primary)]"
                          >
                              机构
                          </button>
                          <button 
                              onClick={() => setRankingDimension('TEAM')}
                              style={{ 
                                padding: '0.375rem 1rem', 
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                borderRadius: 'var(--radius-sm)',
                                background: rankingDimension === 'TEAM' ? 'var(--bg-primary)' : 'transparent',
                                color: rankingDimension === 'TEAM' ? 'var(--primary-700)' : 'var(--text-secondary)',
                                boxShadow: rankingDimension === 'TEAM' ? 'var(--shadow-sm)' : 'none'
                              }}
                              className="transition-all hover:text-[var(--text-primary)]"
                          >
                              团队
                          </button>
                      </div>

                      {statsData.length > 10 && (
                          <button 
                              onClick={() => setIsStatsModalOpen(true)}
                              style={{ color: 'var(--primary-700)' }}
                              className="hidden md:flex text-sm hover:text-[var(--primary-800)] font-medium items-center px-3 py-1.5 rounded-lg hover:bg-[var(--primary-50)] transition-all"
                          >
                              查看全部 <ChevronRight className="w-4 h-4" />
                          </button>
                      )}
                    </div>
                </div>
                
                <div className="space-y-3">
                    {topStats.map((item, index) => (
                        <div 
                          key={item.id} 
                          style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)' }}
                          className="flex items-center hover:bg-[var(--bg-secondary)] transition-colors group"
                        >
                            <div style={{ 
                              width: '2rem', 
                              height: '2rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              borderRadius: 'var(--radius-sm)', 
                              fontSize: '0.875rem', 
                              fontWeight: 700, 
                              marginRight: '1rem', 
                              boxShadow: 'var(--shadow-sm)',
                              background: index === 0 ? 'linear-gradient(to bottom right, var(--warning-500), var(--warning-400))' : 
                                         index === 1 ? 'linear-gradient(to bottom right, var(--gray-500), var(--gray-400))' : 
                                         index === 2 ? 'linear-gradient(to bottom right, var(--orange-500), var(--orange-400))' : 
                                         'var(--bg-secondary)',
                              color: index < 3 ? 'white' : 'var(--text-secondary)'
                            }}>
                                {index + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm mb-2">
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} className="flex items-center">
                                       {rankingDimension === 'USER' && <UserIcon style={{ color: 'var(--text-tertiary)' }} className="w-4 h-4 mr-2"/>}
                                       {rankingDimension === 'INSTITUTION' && <Building2 style={{ color: 'var(--text-tertiary)' }} className="w-4 h-4 mr-2"/>}
                                       {rankingDimension === 'TEAM' && <Network style={{ color: 'var(--text-tertiary)' }} className="w-4 h-4 mr-2"/>}
                                       {item.name}
                                    </span>
                                    <span style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{item.count}</span>
                                </div>
                                <div style={{ height: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '9999px', overflow: 'hidden' }}>
                                    <div 
                                        style={{ 
                                          height: '100%', 
                                          borderRadius: '9999px', 
                                          width: `${(item.count / (maxCount || 1)) * 100}%`,
                                          background: index === 0 ? 'linear-gradient(to right, var(--warning-500), var(--warning-400))' : 
                                                      index === 1 ? 'linear-gradient(to right, var(--gray-500), var(--gray-400))' : 
                                                      index === 2 ? 'linear-gradient(to right, var(--orange-500), var(--orange-400))' : 
                                                      'linear-gradient(to right, var(--primary-700), var(--primary-500))'
                                        }}
                                        className="transition-all duration-500"
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {topStats.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '2rem 0', fontSize: '0.875rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>暂无数据</div>
                    )}
                    
                    {statsData.length > 10 && (
                         <button 
                            onClick={() => setIsStatsModalOpen(true)}
                            style={{ color: 'var(--primary-700)', marginTop: '0.5rem' }}
                            className="md:hidden w-full text-center text-sm hover:text-[var(--primary-800)] font-medium py-3 bg-[var(--bg-secondary)] rounded-xl hover:bg-[var(--primary-50)] transition-all"
                        >
                            查看全部
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Right Sidebar: Quick Actions / Recent Visits */}
        <div className="flex flex-col gap-6">
            {/* Desktop Check-in Button - Enhanced Gradient */}
            <button 
                onClick={handleSmartCheckIn}
                disabled={isCheckingIn}
                style={{ 
                  background: 'linear-gradient(to right, var(--primary-800), var(--primary-700), var(--primary-600))', 
                  color: 'white', 
                  padding: '1.25rem', 
                  borderRadius: 'var(--radius-md)', 
                  boxShadow: 'var(--shadow-lg)'
                }}
                className="hidden md:flex w-full items-center justify-center font-bold text-lg hover:shadow-[0_8px_30px_rgba(30,64,175,0.5)] hover:scale-[1.02] transition-all active:scale-[0.98] group relative overflow-hidden"
            >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                {isCheckingIn ? <Loader2 className="w-6 h-6 animate-spin mr-2"/> : <MapPin className="w-6 h-6 mr-2 animate-bounce" />}
                {isCheckingIn ? '定位匹配中...' : '到达签到'}
            </button>

            {/* Recent Visits - Compact Design */}
            <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }} className="flex flex-col h-fit">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.1)' }} className="flex items-center justify-center">
                      <Clock style={{ color: 'var(--success-500)' }} className="w-4 h-4" />
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>近期拜访</h3>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[420px] pr-1 custom-scrollbar">
                    {visits.slice(0, 8).map((visit) => (
                    <div 
                        key={visit.id} 
                        onClick={() => onViewVisit && onViewVisit(visit.id)}
                        style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid transparent' }}
                        className="group hover:bg-[var(--bg-secondary)] hover:border-[var(--border)] transition-all cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-1.5">
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }} className="truncate pr-2 group-hover:text-[var(--primary-700)] transition-colors">{visit.clientName}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', background: 'var(--bg-secondary)', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>{new Date(visit.date).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} className="flex items-center mb-1.5">
                            <UserIcon className="w-3.5 h-3.5 mr-1.5" /> 
                            <span style={{ fontWeight: 500 }}>{visit.ownerName || 'Unknown'}</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} className="line-clamp-2 leading-relaxed">{visit.summary || visit.content}</p>
                    </div>
                    ))}
                    {visits.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem', padding: '2rem 0', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                      <Clock style={{ opacity: 0.5 }} className="w-8 h-8 mx-auto mb-2" />
                      暂无近期拜访
                    </div>
                    )}
                </div>
                <button 
                    onClick={() => onNavigate('VISITS')}
                    style={{ 
                      marginTop: '1rem', 
                      width: '100%', 
                      padding: '0.625rem 0', 
                      fontSize: '0.875rem', 
                      fontWeight: 600, 
                      color: 'var(--primary-700)', 
                      background: 'var(--primary-50)', 
                      borderRadius: 'var(--radius-md)' 
                    }}
                    className="flex items-center justify-center hover:bg-[var(--primary-100)] transition-all"
                >
                    查看全部 <ArrowRight className="w-4 h-4 ml-1" />
                </button>
            </div>
        </div>
      </div>

      {/* Full Stats Modal - Modern Design */}
      {isStatsModalOpen && (
        <div style={{ background: 'rgba(17, 24, 39, 0.6)', backdropFilter: 'blur(4px)' }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '28rem', maxHeight: '80vh', boxShadow: 'var(--shadow-2xl)' }} className="flex flex-col animate-[scale-in_0.2s_ease-out]">
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)', background: 'rgba(30, 64, 175, 0.1)' }} className="flex items-center justify-center">
                        <Trophy style={{ color: 'var(--primary-700)' }} className="w-5 h-5" />
                      </div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rankingDimension === 'USER' ? '个人' : rankingDimension === 'INSTITUTION' ? '机构' : '团队'}拜访统计
                      </h3>
                    </div>
                    <button 
                      onClick={() => setIsStatsModalOpen(false)} 
                      style={{ width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)' }}
                      className="hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-2">
                    {statsData.map((item, index) => (
                        <div 
                          key={item.id} 
                          style={{ padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid transparent' }}
                          className="flex items-center hover:bg-[var(--bg-secondary)] hover:border-[var(--border)] transition-all"
                        >
                            <div style={{ 
                              width: '2.25rem', 
                              height: '2.25rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              borderRadius: 'var(--radius-sm)', 
                              fontSize: '0.875rem', 
                              fontWeight: 700, 
                              marginRight: '1rem', 
                              boxShadow: 'var(--shadow-sm)',
                              background: index === 0 ? 'linear-gradient(to bottom right, var(--warning-500), var(--warning-400))' : 
                                         index === 1 ? 'linear-gradient(to bottom right, var(--gray-500), var(--gray-400))' : 
                                         index === 2 ? 'linear-gradient(to bottom right, var(--orange-500), var(--orange-400))' : 
                                         'var(--bg-secondary)',
                              color: index < 3 ? 'white' : 'var(--text-secondary)'
                            }}>
                                {index + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm mb-2">
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} className="flex items-center">
                                       {rankingDimension === 'USER' && <UserIcon style={{ color: 'var(--text-tertiary)' }} className="w-4 h-4 mr-2"/>}
                                       {rankingDimension === 'INSTITUTION' && <Building2 style={{ color: 'var(--text-tertiary)' }} className="w-4 h-4 mr-2"/>}
                                       {rankingDimension === 'TEAM' && <Network style={{ color: 'var(--text-tertiary)' }} className="w-4 h-4 mr-2"/>}
                                       {item.name}
                                    </span>
                                    <span style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{item.count}</span>
                                </div>
                                <div style={{ height: '0.375rem', background: 'var(--bg-secondary)', borderRadius: '9999px', overflow: 'hidden' }}>
                                    <div 
                                        style={{ 
                                          height: '100%', 
                                          background: 'linear-gradient(to right, var(--primary-700), var(--primary-500))', 
                                          borderRadius: '9999px',
                                          width: `${(item.count / (maxCount || 1)) * 100}%`
                                        }}
                                        className="transition-all duration-500"
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
