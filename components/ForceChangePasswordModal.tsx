import React, { useState } from 'react';
import { User } from '../types';
import { hashPassword, upsertUser } from '../services/supabaseService';
import { Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface ForceChangePasswordModalProps {
  user: User;
  onPasswordChanged: (updatedUser: User) => void;
}

export const ForceChangePasswordModal: React.FC<ForceChangePasswordModalProps> = ({ user, onPasswordChanged }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
        setError("新密码长度至少需要 6 位");
        return;
    }
    if (newPassword !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
    }
    if (newPassword === '123456') {
        setError("新密码不能与默认密码相同");
        return;
    }

    setIsSaving(true);
    setError(null);

    try {
        const hashedPassword = await hashPassword(newPassword);
        const updatedUser = { ...user, password: hashedPassword };
        
        await upsertUser(updatedUser);
        onPasswordChanged(updatedUser);
    } catch (e) {
        console.error(e);
        setError("保存失败，请重试");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
       <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
          <div className="bg-amber-50 p-6 border-b border-amber-100 text-center">
             <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-amber-600" />
             </div>
             <h2 className="text-xl font-bold text-amber-800">安全提示：修改密码</h2>
             <p className="text-sm text-amber-700 mt-2">
                您正在使用初始密码登录。为了保障账户安全，请立即设置一个新的登录密码。
             </p>
          </div>
          
          <div className="p-6">
             <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">新密码</label>
                   <input 
                      type="password"
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="至少 6 位字符"
                   />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">确认新密码</label>
                   <input 
                      type="password"
                      required
                      className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="再次输入新密码"
                   />
                </div>

                {error && (
                    <div className="flex items-center text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        {error}
                    </div>
                )}

                <button 
                   type="submit"
                   disabled={isSaving}
                   className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-md transition-colors flex justify-center items-center"
                >
                   {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : '确认修改并进入系统'}
                </button>
             </form>
          </div>
       </div>
    </div>
  );
};