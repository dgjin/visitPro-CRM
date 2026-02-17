import React, { useState, useEffect } from 'react';
import { Handshake, Loader2, Lock, Mail, Settings, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { loginUser, getStoredConfig, saveConfig, checkConnection, isConfiguredFromEnv } from '../services/supabaseService';
import { User } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  isOfflineMode?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, isOfflineMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Config State
  const [showConfig, setShowConfig] = useState(false);
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [isCheckingConfig, setIsCheckingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const isEnvConfig = isConfiguredFromEnv();

  useEffect(() => {
      // Load existing config
      if (!isEnvConfig) {
          const config = getStoredConfig();
          setSbUrl(config.url || '');
          setSbKey(config.key || '');
      }
  }, [isEnvConfig]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
        setErrorMsg("请输入邮箱和密码");
        return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
        if (isOfflineMode) {
            // Mock Login for demo when no DB is configured/connected
            setTimeout(() => {
                alert("当前为离线/演示模式，请先配置数据库以使用完整功能。");
                setIsLoading(false);
            }, 500);
            return;
        }

        const result = await loginUser(email, password);
        if (result.success && result.user) {
            onLoginSuccess(result.user);
        } else {
            setErrorMsg(result.message || "登录失败");
        }
    } catch (err: any) {
        setErrorMsg(err.message || "系统错误");
    } finally {
        setIsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
      if (!sbUrl || !sbKey) {
          setConfigMsg({ type: 'error', text: "URL 和 Key 不能为空" });
          return;
      }

      setIsCheckingConfig(true);
      setConfigMsg(null);

      try {
          saveConfig(sbUrl, sbKey);
          const result = await checkConnection();
          if (result.success) {
              setConfigMsg({ type: 'success', text: "连接成功！请尝试登录。" });
              setTimeout(() => setShowConfig(false), 1500);
          } else {
              setConfigMsg({ type: 'error', text: `连接失败: ${result.message}` });
          }
      } catch (e: any) {
          setConfigMsg({ type: 'error', text: `配置错误: ${e.message}` });
      } finally {
          setIsCheckingConfig(false);
      }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans text-slate-900">
      
      {/* Left Side - Branding (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-950 relative overflow-hidden flex-col justify-between p-16 text-white transition-colors duration-500">
         {/* Background Decoration */}
         <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
         <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
         
         <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-12">
               <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Handshake className="w-7 h-7 text-white" />
               </div>
               <span className="text-2xl font-bold tracking-tight">VisitPro CRM</span>
            </div>
            
            <h1 className="text-5xl font-bold leading-tight mb-6">
               智能驱动 <br/> 
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-indigo-100">沟通效能飞跃</span>
            </h1>
            <p className="text-indigo-100 text-lg max-w-md leading-relaxed opacity-80">
               全流程自动化 CRM，从语音录入到 AI 智能画像，为您提供前所未有的客户洞察。
            </p>
         </div>

         <div className="relative z-10 flex items-center space-x-4 text-sm text-indigo-200">
            <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-indigo-950 bg-indigo-800 flex items-center justify-center text-xs text-indigo-300">
                        <UserIconMini />
                    </div>
                ))}
            </div>
            <span>珍惜每一次沟通，用心做好每一次服务</span>
         </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-24 relative bg-slate-50 lg:bg-white overflow-y-auto">
         
         {/* Config Toggle Button */}
         <button 
            onClick={() => setShowConfig(!showConfig)}
            className={`absolute top-6 right-6 p-2 rounded-full transition-all duration-300 ${showConfig ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
            title="数据库配置"
         >
            <Settings className="w-6 h-6" />
         </button>

         <div className="w-full max-w-md space-y-8 animate-fade-in-up">
            <div className="text-center lg:text-left">
               <div className="lg:hidden flex justify-center mb-6">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                     <Handshake className="w-8 h-8 text-white" />
                  </div>
               </div>
               <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">欢迎回来</h2>
               <p className="text-slate-500 mt-2 text-sm">请输入您的账户信息以登录系统</p>
            </div>

            {/* Database Config Panel (Expandable) */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showConfig ? 'max-h-[500px] opacity-100 mb-8' : 'max-h-0 opacity-0'}`}>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-700 text-sm">数据库连接设置</h3>
                        {isEnvConfig && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">ENV 模式</span>}
                    </div>
                    
                    {isEnvConfig ? (
                        <div className="text-sm text-emerald-600 py-4 flex flex-col items-center bg-emerald-50 rounded-xl border border-emerald-100">
                            <CheckCircle className="w-8 h-8 mb-2" />
                            <p>已通过环境变量配置 Supabase</p>
                            <p className="text-xs text-emerald-500 mt-1">如需修改，请更新 .env 文件</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Supabase URL</label>
                                <input 
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    placeholder="https://xyz.supabase.co"
                                    value={sbUrl}
                                    onChange={e => setSbUrl(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Anon Key</label>
                                <input 
                                    type="password"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    placeholder="eyJh..."
                                    value={sbKey}
                                    onChange={e => setSbKey(e.target.value)}
                                />
                            </div>
                            
                            {configMsg && (
                                <div className={`text-xs p-3 rounded-lg flex items-start ${configMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                    {configMsg.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />}
                                    {configMsg.text}
                                </div>
                            )}

                            <button 
                                onClick={handleSaveConfig}
                                disabled={isCheckingConfig}
                                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-70 flex items-center justify-center"
                            >
                                {isCheckingConfig && <Loader2 className="w-3 h-3 animate-spin mr-2"/>}
                                {isCheckingConfig ? '连接测试中...' : '保存配置并连接'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Login Form */}
            <form className="space-y-5" onSubmit={handleLogin}>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">邮箱地址</label>
                  <div className="relative group">
                     <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                     </div>
                     <input 
                        type="email" 
                        required
                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                        placeholder="name@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                     />
                  </div>
               </div>

               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">密码</label>
                  <div className="relative group">
                     <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                     </div>
                     <input 
                        type={showPassword ? "text" : "password"}
                        required
                        className="block w-full pl-11 pr-12 py-3.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                     />
                     <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-600 focus:outline-none"
                     >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                     </button>
                  </div>
               </div>

               {errorMsg && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start animate-shake">
                     <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                     <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
                  </div>
               )}

               <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
               >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '立即登录'}
               </button>
            </form>
            
            <div className="pt-6 border-t border-slate-100">
                <div className="flex justify-between text-xs text-slate-400 px-2">
                    <p>默认管理员: <span className="text-slate-600 font-medium">admin@visitpro.com</span></p>
                    <p>初始密码: <span className="text-slate-600 font-medium">123456</span></p>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

// Simple User Icon SVG for the decorative section
const UserIconMini = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
    </svg>
);
