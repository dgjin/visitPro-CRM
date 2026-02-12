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
  Loader2
} from 'lucide-react';
import { Visit, Client, ClientStatus, User, Department, Sentiment } from '../types';

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
  const activeClients = clients.filter(c => c.status === ClientStatus.Active).length;
  const leads = clients.filter(c => c.status === ClientStatus.Lead).length;
  const churned = clients.filter(c => c.status === ClientStatus.Churned).length;
  
  const visitsThisMonth = visits.length; // Simplified for demo
  const conversionRate = Math.round((activeClients / (totalClients || 1)) * 100);

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
      const myClients = clients.filter(c => c.ownerId === currentUser.id);

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

      // Rule 3: Churn Risk (Urgent)
      myClients.filter(c => c.status === ClientStatus.Churned).slice(0, 1).forEach(c => {
          actions.push({
              id: `churn_${c.id}`,
              title: '流失挽回',
              desc: `客户 ${c.name} 标记为流失，建议进行关怀回访。`,
              type: 'URGENT',
              clientName: c.name,
              clientId: c.id
          });
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

  const StatCard = ({ title, value, subtext, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
        {subtext && <p className={`text-xs mt-2 ${subtext.includes('+') ? 'text-emerald-600' : 'text-slate-400'}`}>{subtext}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 relative">
      {/* Mobile Smart Check-in Header (Visible mostly on mobile) */}
      <div className="md:hidden mb-4">
          <button 
            onClick={handleSmartCheckIn}
            disabled={isCheckingIn}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-center font-bold text-lg active:scale-95 transition-all"
          >
             {isCheckingIn ? <Loader2 className="w-6 h-6 animate-spin mr-2"/> : <MapPin className="w-6 h-6 mr-2 animate-bounce" />}
             {isCheckingIn ? '定位匹配中...' : '到达签到'}
          </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="客户总数" 
          value={totalClients} 
          subtext={`+${leads} 新增线索`} 
          icon={Users} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="本月拜访" 
          value={visitsThisMonth} 
          subtext="环比上月 +12%" 
          icon={TrendingUp} 
          color="bg-indigo-500" 
        />
        <StatCard 
          title="转化率" 
          value={`${conversionRate}%`} 
          subtext="线索转签约" 
          icon={CheckCircle} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="风险预警" 
          value={churned} 
          subtext="需要关注" 
          icon={AlertTriangle} 
          color="bg-amber-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* 1. AI Suggested Actions (New) */}
            {suggestedActions.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center relative z-10">
                        <Zap className="w-5 h-5 mr-2 text-amber-500 fill-current" />
                        今日建议 (Suggested Actions)
                    </h3>
                    <div className="space-y-3 relative z-10">
                        {suggestedActions.map(action => (
                            <div key={action.id} className="flex items-start bg-white p-3 rounded-xl border border-indigo-50 shadow-sm hover:shadow-md transition-all">
                                <div className={`p-2 rounded-lg mr-3 flex-shrink-0 ${action.type === 'URGENT' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {action.type === 'URGENT' ? <AlertTriangle className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-700 text-sm">{action.title}</h4>
                                        <button 
                                            onClick={() => {
                                                // Handle Execution Logic
                                                if (action.id.startsWith('todo') && action.visitId) {
                                                    // For tasks, view the original visit
                                                    onViewVisit && onViewVisit(action.visitId);
                                                } else if (onCheckIn && action.clientId) {
                                                    // For opportunities or churn recovery, start a new visit draft
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
                                            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition-colors"
                                        >
                                            执行
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{action.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">每周活动趋势</h3>
                    <select className="text-sm border-none bg-slate-50 rounded-lg px-3 py-1 text-slate-600">
                    <option>本周</option>
                    <option>上周</option>
                    </select>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 12 }} 
                        dy={10}
                        />
                        <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 12 }} 
                        />
                        <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="visits" radius={[4, 4, 0, 0]} barSize={32}>
                        {activityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 3 ? '#4f46e5' : '#cbd5e1'} />
                        ))}
                        </Bar>
                    </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Visit Stats */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <Trophy className="w-5 h-5 mr-2 text-amber-500" />
                        {rankingDimension === 'USER' ? '个人' : rankingDimension === 'INSTITUTION' ? '机构' : '团队'}拜访排行
                    </h3>
                    
                    <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setRankingDimension('USER')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${rankingDimension === 'USER' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            人员
                        </button>
                        <button 
                            onClick={() => setRankingDimension('INSTITUTION')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${rankingDimension === 'INSTITUTION' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            机构
                        </button>
                        <button 
                            onClick={() => setRankingDimension('TEAM')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${rankingDimension === 'TEAM' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            团队
                        </button>
                    </div>

                    {statsData.length > 10 && (
                        <button 
                            onClick={() => setIsStatsModalOpen(true)}
                            className="hidden md:flex text-sm text-indigo-600 hover:text-indigo-800 font-medium items-center ml-auto"
                        >
                            查看全部 <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
                
                <div className="space-y-3">
                    {topStats.map((item, index) => (
                        <div key={item.id} className="flex items-center">
                            <div className={`w-6 text-center text-sm font-bold mr-2 ${index < 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                                {index + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700 flex items-center">
                                       {rankingDimension === 'USER' && <UserIcon className="w-3 h-3 mr-1.5 text-slate-400"/>}
                                       {rankingDimension === 'INSTITUTION' && <Building2 className="w-3 h-3 mr-1.5 text-slate-400"/>}
                                       {rankingDimension === 'TEAM' && <Network className="w-3 h-3 mr-1.5 text-slate-400"/>}
                                       {item.name}
                                    </span>
                                    <span className="font-bold text-indigo-600">{item.count}</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${index === 0 ? 'bg-amber-400' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-orange-400' : 'bg-indigo-400'}`} 
                                        style={{ width: `${(item.count / (maxCount || 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {topStats.length === 0 && (
                        <div className="text-center text-slate-400 py-4 text-sm">暂无数据</div>
                    )}
                    
                    {statsData.length > 10 && (
                         <button 
                            onClick={() => setIsStatsModalOpen(true)}
                            className="md:hidden mt-2 w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium py-2 bg-slate-50 rounded-lg"
                        >
                            查看全部
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Right Sidebar: Quick Actions / Recent Visits */}
        <div className="flex flex-col gap-6">
            {/* Desktop Check-in Button */}
            <button 
                onClick={handleSmartCheckIn}
                disabled={isCheckingIn}
                className="hidden md:flex w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-4 rounded-2xl shadow-lg items-center justify-center font-bold text-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
            >
                {isCheckingIn ? <Loader2 className="w-6 h-6 animate-spin mr-2"/> : <MapPin className="w-6 h-6 mr-2 animate-bounce" />}
                {isCheckingIn ? '定位匹配中...' : '到达签到'}
            </button>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-fit">
                <h3 className="text-lg font-bold text-slate-800 mb-4">近期拜访</h3>
                <div className="flex-1 overflow-y-auto space-y-4 max-h-[500px] pr-2">
                    {visits.slice(0, 8).map((visit) => (
                    <div 
                        key={visit.id} 
                        onClick={() => onViewVisit && onViewVisit(visit.id)}
                        className="group p-3 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm text-slate-800 truncate pr-2 group-hover:text-indigo-600 transition-colors">{visit.clientName}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(visit.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center text-xs text-slate-500 mb-1">
                            <UserIcon className="w-3 h-3 mr-1" /> {visit.ownerName || 'Unknown'}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{visit.summary || visit.content}</p>
                    </div>
                    ))}
                    {visits.length === 0 && (
                    <div className="text-center text-slate-400 text-sm py-8">暂无近期拜访</div>
                    )}
                </div>
                <button 
                    onClick={() => onNavigate('VISITS')}
                    className="mt-4 w-full py-2 flex items-center justify-center text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                    查看全部 <ArrowRight className="w-4 h-4 ml-1" />
                </button>
            </div>
        </div>
      </div>

      {/* Full Stats Modal */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-scale-in">
                <div className="flex justify-between items-center p-4 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">
                        {rankingDimension === 'USER' ? '个人' : rankingDimension === 'INSTITUTION' ? '机构' : '团队'}拜访统计
                    </h3>
                    <button onClick={() => setIsStatsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {statsData.map((item, index) => (
                        <div key={item.id} className="flex items-center p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100">
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold mr-3 ${
                                index === 0 ? 'bg-amber-100 text-amber-600' : 
                                index === 1 ? 'bg-slate-100 text-slate-600' : 
                                index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-500'
                            }`}>
                                {index + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-800 flex items-center">
                                       {rankingDimension === 'USER' && <UserIcon className="w-3 h-3 mr-1.5 text-slate-400"/>}
                                       {rankingDimension === 'INSTITUTION' && <Building2 className="w-3 h-3 mr-1.5 text-slate-400"/>}
                                       {rankingDimension === 'TEAM' && <Network className="w-3 h-3 mr-1.5 text-slate-400"/>}
                                       {item.name}
                                    </span>
                                    <span className="font-bold text-indigo-600">{item.count}</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-500 rounded-full" 
                                        style={{ width: `${(item.count / (maxCount || 1)) * 100}%` }}
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