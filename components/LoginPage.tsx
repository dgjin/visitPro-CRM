import React, { useState, useEffect } from 'react';
import { Handshake, Loader2, Lock, Mail, Settings, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { loginUser, getStoredConfig, saveConfig, checkConnection, isConfiguredFromEnv } from '../services/apiService';
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
        setErrorMsg("请输入账号（邮箱或手机号）和密码");
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
    <div className="min-h-screen flex" style={{ background: 'var(--bg-secondary)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
      
      {/* Left Side - Branding (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-16 text-white"
           style={{ background: 'linear-gradient(135deg, var(--primary-900) 0%, var(--primary-950) 100%)' }}>
         
         {/* Background Decoration */}
         <div style={{
           position: 'absolute',
           top: '-5rem',
           right: '-5rem',
           width: '24rem',
           height: '24rem',
           background: 'var(--primary-600)',
           borderRadius: '50%',
           filter: 'blur(80px)',
           opacity: 0.15,
           animation: 'pulse 8s ease-in-out infinite'
         }}></div>
         <div style={{
           position: 'absolute',
           bottom: '-5rem',
           left: '-5rem',
           width: '20rem',
           height: '20rem',
           background: 'var(--primary-400)',
           borderRadius: '50%',
           filter: 'blur(80px)',
           opacity: 0.1,
           animation: 'pulse 8s ease-in-out infinite 2s'
         }}></div>
         <div style={{
           position: 'absolute',
           top: '50%',
           left: '50%',
           transform: 'translate(-50%, -50%)',
           width: '32rem',
           height: '32rem',
           background: 'var(--primary-700)',
           borderRadius: '50%',
           filter: 'blur(100px)',
           opacity: 0.08
         }}></div>
         
         <div className="relative z-10" style={{ animation: 'fadeInUp 0.8s ease-out' }}>
            <div className="flex items-center gap-3 mb-12">
               <div style={{
                 width: '3rem',
                 height: '3rem',
                 background: 'var(--primary-600)',
                 borderRadius: 'var(--radius-md)',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 boxShadow: '0 8px 24px rgba(37, 99, 235, 0.3)'
               }}>
                  <Handshake className="w-7 h-7 text-white" />
               </div>
               <span style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>VisitPro CRM</span>
            </div>
            
            <h1 style={{ 
              fontSize: '3rem', 
              fontWeight: 700, 
              lineHeight: 1.2, 
              marginBottom: '1.5rem',
              letterSpacing: '-0.02em'
            }}>
               智能驱动 <br/> 
               <span style={{ 
                 background: 'linear-gradient(135deg, var(--primary-200) 0%, white 100%)',
                 WebkitBackgroundClip: 'text',
                 WebkitTextFillColor: 'transparent',
                 backgroundClip: 'text'
               }}>沟通效能飞跃</span>
            </h1>
            <p style={{ 
              color: 'var(--primary-200)', 
              fontSize: '1.125rem', 
              maxWidth: '28rem', 
              lineHeight: 1.7,
              opacity: 0.85
            }}>
               全流程自动化 CRM，从语音录入到 AI 智能画像，为您提供前所未有的客户洞察。
            </p>
         </div>

         <div className="relative z-10 flex items-center gap-4" style={{ animation: 'fadeInUp 0.8s ease-out 0.2s backwards' }}>
            <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                    <div key={i} style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      border: '2px solid var(--primary-900)',
                      background: 'var(--primary-700)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      color: 'var(--primary-200)'
                    }}>
                        <UserIconMini />
                    </div>
                ))}
            </div>
            <span style={{ fontSize: '0.875rem', color: 'var(--primary-300)' }}>珍惜每一次沟通，用心做好每一次服务</span>
         </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-24 relative overflow-y-auto"
           style={{ background: 'var(--bg-secondary)' }}>
         
         {/* Config Toggle Button */}
         <button 
            onClick={() => setShowConfig(!showConfig)}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              padding: '0.5rem',
              borderRadius: 'var(--radius)',
              transition: 'all var(--transition)',
              background: showConfig ? 'var(--primary-100)' : 'transparent',
              color: showConfig ? 'var(--primary-600)' : 'var(--text-tertiary)',
              transform: showConfig ? 'rotate(180deg)' : 'none',
              border: 'none',
              cursor: 'pointer'
            }}
            title="数据库配置"
         >
            <Settings className="w-5 h-5" />
         </button>

         <div style={{ 
           width: '100%', 
           maxWidth: '28rem',
           animation: 'fadeInUp 0.6s ease-out'
         }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
               <div className="lg:hidden" style={{ 
                 display: 'flex', 
                 justifyContent: 'center', 
                 marginBottom: '1.5rem',
                 animation: 'scaleIn 0.5s ease-out'
               }}>
                  <div style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    background: 'var(--primary-600)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.2)'
                  }}>
                     <Handshake className="w-8 h-8 text-white" />
                  </div>
               </div>
               <h2 style={{ 
                 fontSize: '1.875rem', 
                 fontWeight: 700, 
                 color: 'var(--text-primary)',
                 marginBottom: '0.5rem',
                 letterSpacing: '-0.02em'
               }}>欢迎回来</h2>
               <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>请输入您的账户信息以登录系统</p>
            </div>

            {/* Database Config Panel (Expandable) */}
            <div style={{
              maxHeight: showConfig ? '500px' : '0',
              opacity: showConfig ? 1 : 0,
              overflow: 'hidden',
              transition: 'all var(--transition-slow) ease-in-out',
              marginBottom: showConfig ? '1.5rem' : '0'
            }}>
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: '1.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow)'
                }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: '1rem'
                    }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>数据库连接设置</h3>
                        {isEnvConfig && (
                          <span style={{
                            fontSize: '0.625rem',
                            fontWeight: 500,
                            padding: '0.25rem 0.5rem',
                            background: 'var(--success-light)',
                            color: '#065f46',
                            borderRadius: '9999px'
                          }}>ENV 模式</span>
                        )}
                    </div>
                    
                    {isEnvConfig ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '1.5rem',
                          background: 'var(--success-light)',
                          borderRadius: 'var(--radius)',
                          border: '1px solid #a7f3d0'
                        }}>
                            <CheckCircle style={{ width: '2rem', height: '2rem', color: 'var(--success)', marginBottom: '0.5rem' }} />
                            <p style={{ fontSize: '0.875rem', color: '#065f46' }}>已通过环境变量配置 Supabase</p>
                            <p style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem' }}>如需修改，请更新 .env 文件</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ 
                                  display: 'block', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 500, 
                                  color: 'var(--text-secondary)',
                                  marginBottom: '0.375rem'
                                }}>Supabase URL</label>
                                <input 
                                    type="text"
                                    className="input"
                                    placeholder="https://xyz.supabase.co"
                                    value={sbUrl}
                                    onChange={e => setSbUrl(e.target.value)}
                                    style={{ fontSize: '0.75rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ 
                                  display: 'block', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 500, 
                                  color: 'var(--text-secondary)',
                                  marginBottom: '0.375rem'
                                }}>Anon Key</label>
                                <input 
                                    type="password"
                                    className="input"
                                    placeholder="eyJh..."
                                    value={sbKey}
                                    onChange={e => setSbKey(e.target.value)}
                                    style={{ fontSize: '0.75rem' }}
                                />
                            </div>
                            
                            {configMsg && (
                                <div style={{
                                  fontSize: '0.75rem',
                                  padding: '0.75rem',
                                  borderRadius: 'var(--radius)',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '0.5rem',
                                  background: configMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                                  color: configMsg.type === 'success' ? '#065f46' : 'var(--danger)',
                                  border: `1px solid ${configMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`
                                }}>
                                    {configMsg.type === 'success' ? 
                                      <CheckCircle style={{ width: '1rem', height: '1rem', flexShrink: 0 }} /> : 
                                      <AlertCircle style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
                                    }
                                    {configMsg.text}
                                </div>
                            )}

                            <button 
                                onClick={handleSaveConfig}
                                disabled={isCheckingConfig}
                                className="btn"
                                style={{
                                  width: '100%',
                                  background: 'var(--text-primary)',
                                  color: 'white',
                                  fontSize: '0.75rem',
                                  opacity: isCheckingConfig ? 0.7 : 1,
                                  cursor: isCheckingConfig ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isCheckingConfig && <Loader2 className="w-3 h-3 animate-spin" />}
                                {isCheckingConfig ? '连接测试中...' : '保存配置并连接'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Login Form */}
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} onSubmit={handleLogin}>
               <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: 500, 
                    color: 'var(--text-secondary)',
                    marginBottom: '0.5rem'
                  }}>账号</label>
                  <div style={{ position: 'relative' }}>
                     <div style={{
                       position: 'absolute',
                       left: '1rem',
                       top: '50%',
                       transform: 'translateY(-50%)',
                       color: 'var(--text-tertiary)',
                       transition: 'color var(--transition-fast)'
                     }} className="input-icon">
                        <Mail className="w-5 h-5" />
                     </div>
                     <input 
                        type="text" 
                        required
                        className="input"
                        placeholder="邮箱或手机号"
                        autoComplete="username"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={{ paddingLeft: '2.75rem' }}
                        onFocus={(e) => {
                          const icon = e.target.previousElementSibling as HTMLElement;
                          if (icon) icon.style.color = 'var(--primary-500)';
                        }}
                        onBlur={(e) => {
                          const icon = e.target.previousElementSibling as HTMLElement;
                          if (icon) icon.style.color = 'var(--text-tertiary)';
                        }}
                     />
                  </div>
               </div>

               <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: 500, 
                    color: 'var(--text-secondary)',
                    marginBottom: '0.5rem'
                  }}>密码</label>
                  <div style={{ position: 'relative' }}>
                     <div style={{
                       position: 'absolute',
                       left: '1rem',
                       top: '50%',
                       transform: 'translateY(-50%)',
                       color: 'var(--text-tertiary)',
                       transition: 'color var(--transition-fast)'
                     }} className="input-icon">
                        <Lock className="w-5 h-5" />
                     </div>
                     <input 
                        type={showPassword ? "text" : "password"}
                        required
                        className="input"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                        onFocus={(e) => {
                          const icon = e.target.previousElementSibling as HTMLElement;
                          if (icon) icon.style.color = 'var(--primary-500)';
                        }}
                        onBlur={(e) => {
                          const icon = e.target.previousElementSibling as HTMLElement;
                          if (icon) icon.style.color = 'var(--text-tertiary)';
                        }}
                     />
                     <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '1rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          padding: '0.25rem',
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                          transition: 'color var(--transition-fast)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary-600)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
                        }}
                     >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                     </button>
                  </div>
               </div>

               {errorMsg && (
                  <div style={{
                    padding: '1rem',
                    background: 'var(--danger-light)',
                    border: '1px solid #fecaca',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    animation: 'shake 0.5s ease-in-out'
                  }}>
                     <AlertCircle style={{ width: '1.25rem', height: '1.25rem', color: 'var(--danger)', flexShrink: 0, marginTop: '0.125rem' }} />
                     <p style={{ fontSize: '0.875rem', color: 'var(--danger)', fontWeight: 500 }}>{errorMsg}</p>
                  </div>
               )}

               <button 
                  type="submit" 
                  disabled={isLoading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1.5rem',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    opacity: isLoading ? 0.7 : 1,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    marginTop: '0.5rem'
                  }}
               >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '立即登录'}
               </button>
            </form>
            
            <div style={{
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--border)'
            }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  padding: '0 0.5rem'
                }}>
                    <p>支持邮箱或手机号登录</p>
                    <p>默认管理员: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>admin@visitpro.com</span></p>
                </div>
            </div>
         </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

// Simple User Icon SVG for the decorative section
const UserIconMini = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
    </svg>
);
