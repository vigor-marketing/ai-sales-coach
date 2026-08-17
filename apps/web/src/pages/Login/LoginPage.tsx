import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { HardHat, Mail, Lock, User, Sparkles, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, setup, checkSetup, needsSetup, loading } = useAuthStore();

  useEffect(() => {
    checkSetup();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (needsSetup) {
        await setup(email, name, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-red-50 to-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle decorative background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-red-100/60 to-transparent rounded-full blur-3xl -translate-y-1/4 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-red-100/40 to-transparent rounded-full blur-3xl translate-y-1/4 -translate-x-1/4" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-r from-transparent via-red-50/50 to-transparent blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-5 shadow-xl shadow-neutral-900/20">
            <HardHat size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">AI销售陪练</h1>
          <p className="text-slate-500 mt-2 text-sm">石油天然气钻完井工具 · 智能销售训练平台</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200/60 p-8">
          {/* Welcome text */}
          <div className="mb-7">
            <h2 className="text-xl font-semibold text-slate-800">
              {needsSetup ? '初始化主账号' : '欢迎回来'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {needsSetup ? '请设置管理员账号信息' : '登录以继续你的训练'}
            </p>
          </div>

          {needsSetup && (
            <div className="flex items-center gap-2.5 mb-5 p-3.5 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
              <Sparkles size={16} className="text-red-600 shrink-0" />
              首次使用，请设置主账号
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {needsSetup ? '主账号邮箱' : '邮箱账号'}
              </label>
              <div className="relative group">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={needsSetup ? "admin@company.com" : "name@company.com"}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all duration-200"
                />
              </div>
            </div>

            {/* Name (setup only) */}
            {needsSetup && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">主账号名称</label>
                <div className="relative group">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：张三"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400
                               focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all duration-200"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">密码</label>
              <div className="relative group">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={needsSetup ? "设置密码" : "输入密码"}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all duration-200"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700
                           text-white font-medium rounded-xl shadow-lg shadow-red-700/15
                           hover:shadow-xl hover:shadow-red-700/25 active:scale-[0.98]
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                           transition-all duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    处理中...
                  </span>
                ) : (
                  <>
                    {needsSetup ? '创建并登录' : '登录'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-xs mt-8">
          AI销售陪练系统 v1.0 · 内部使用
        </p>
      </div>
    </div>
  );
}
