import React from 'react';
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
  ArrowRight
} from 'lucide-react';
import { Visit, Client, ClientStatus } from '../types';

interface DashboardProps {
  visits: Visit[];
  clients: Client[];
  onNavigate: (view: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ visits, clients, onNavigate }) => {
  // Calculated Stats
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === ClientStatus.Active).length;
  const leads = clients.filter(c => c.status === ClientStatus.Lead).length;
  const churned = clients.filter(c => c.status === ClientStatus.Churned).length;
  
  const visitsThisMonth = visits.length; // Simplified for demo
  const conversionRate = Math.round((activeClients / (totalClients || 1)) * 100);

  // Mock Data for Charts
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
    <div className="space-y-6">
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
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
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

        {/* Quick Actions / Recent Visits */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-4">近期拜访</h3>
          <div className="flex-1 overflow-y-auto space-y-4 max-h-[300px] pr-2">
            {visits.slice(0, 5).map((visit) => (
              <div key={visit.id} className="group p-3 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all cursor-pointer">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm text-slate-800">{visit.clientName}</span>
                  <span className="text-xs text-slate-400">{new Date(visit.date).toLocaleDateString()}</span>
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
  );
};