import { useState, useEffect } from 'react';
import { Key, UserPlus, Users, Shield, HardHat, Sparkles, Pencil, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import api from '../../api/apiClient';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai-api-key') || '');
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('openai-base-url') || '');
  const [model, setModel] = useState(localStorage.getItem('openai-model') || 'deepseek-chat');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  // Profile edit
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  // Sub-account edit
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccEmail, setEditAccEmail] = useState('');
  const [editAccPassword, setEditAccPassword] = useState('');
  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      api.get('/auth/users').then(res => setAccounts(res.data)).catch(() => {});
    }
  }, [user]);

  const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  const handleSave = () => {
    localStorage.setItem('openai-api-key', apiKey);
    localStorage.setItem('openai-base-url', baseUrl);
    localStorage.setItem('openai-model', model);
    showMsg('设置已保存（需重启服务器生效）');
  };

  // Edit own profile
  const handleEditProfile = async () => {
    try {
      const res = await api.put('/auth/profile', { name: editName, email: editEmail });
      setUser(res.data);
      setShowProfileEdit(false);
      showMsg('信息修改成功');
    } catch (err: any) {
      showMsg(err.response?.data?.error || '修改失败');
    }
  };

  const handleCreateAccount = async () => {
    if (!newEmail || !newName || !newPassword) return;
    try {
      await api.post('/auth/register', { email: newEmail, name: newName, password: newPassword });
      setNewEmail(''); setNewName(''); setNewPassword('');
      const res = await api.get('/auth/users');
      setAccounts(res.data);
      showMsg('子账号创建成功');
    } catch (err: any) {
      showMsg(err.response?.data?.error || '创建失败');
    }
  };

  // Edit sub-account
  const handleEditAccount = async () => {
    if (!editingAccount) return;
    try {
      const data: any = {};
      if (editAccName) data.name = editAccName;
      if (editAccEmail) data.email = editAccEmail;
      if (editAccPassword) data.password = editAccPassword;
      await api.put(`/auth/users/${editingAccount.id}`, data);
      setEditingAccount(null);
      setEditAccName(''); setEditAccEmail(''); setEditAccPassword('');
      const res = await api.get('/auth/users');
      setAccounts(res.data);
      showMsg('账号修改成功');
    } catch (err: any) {
      showMsg(err.response?.data?.error || '修改失败');
    }
  };

  // Delete sub-account
  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('确定要删除此账号？相关数据将一起删除。')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      const res = await api.get('/auth/users');
      setAccounts(res.data);
      showMsg('账号已删除');
    } catch (err: any) {
      showMsg(err.response?.data?.error || '删除失败');
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!oldPassword || !newPwd) { showMsg('请填写原密码和新密码'); return; }
    if (newPwd !== confirmPwd) { showMsg('两次输入的密码不一致'); return; }
    if (newPwd.length < 6) { showMsg('密码长度不能少于6位'); return; }
    try {
      await api.put('/auth/password', { oldPassword, newPassword: newPwd });
      setOldPassword(''); setNewPwd(''); setConfirmPwd('');
      setShowPasswordForm(false);
      showMsg('密码修改成功');
    } catch (err: any) {
      showMsg(err.response?.data?.error || '修改密码失败');
    }
  };

  if (!user) return null;

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-secondary-900 mb-1">
        {user.role === 'ADMIN' ? '系统设置' : '个人设置'}
      </h2>
      <p className="text-sm text-secondary-500 mb-6">
        {user.role === 'ADMIN' ? '管理系统配置与账号' : '查看个人信息'}
      </p>

      {user.role !== 'ADMIN' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-center gap-2.5 mb-6">
          <Shield size={16} className="shrink-0" />
          子账号暂无设置权限，如需修改请联系主账号
        </div>
      )}

      {message && <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-xl text-primary-700 text-sm animate-fade-in">{message}</div>}

      <div className="space-y-6">
        {/* Account Info */}
        <div className="card">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-secondary-900">
            <div className="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
              <HardHat size={14} className="text-white" />
            </div>
            账号信息
          </h3>
          {showProfileEdit ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-secondary-600 mb-1 block">名称</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-600 mb-1 block">邮箱</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="input text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleEditProfile} className="btn-primary text-sm">保存</button>
                <button onClick={() => setShowProfileEdit(false)} className="btn-ghost text-sm">取消</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                { label: '名称', value: user.name },
                { label: '邮箱', value: user.email },
                { label: '角色', value: user.role === 'ADMIN' ? '主账号' : '子账号', highlight: user.role === 'ADMIN' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-secondary-50 rounded-xl">
                  <span className="text-sm text-secondary-500">{item.label}</span>
                  <span className={`text-sm font-medium ${item.highlight ? 'text-primary-600' : 'text-secondary-800'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
              <button onClick={() => { setEditName(user.name); setEditEmail(user.email); setShowProfileEdit(true); }}
                className="btn-ghost text-xs"><Pencil size={13} /> 修改信息</button>
              <button onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="btn-ghost text-xs ml-2"><Key size={13} /> 修改密码</button>
            </div>
          )}
          {/* Password Change Form */}
          {showPasswordForm && (
            <div className="mt-3 p-3 bg-secondary-50 rounded-xl space-y-3 animate-slide-up">
              <p className="text-xs font-medium text-secondary-600">修改密码</p>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="原密码" className="input text-xs" />
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="新密码（至少6位）" className="input text-xs" />
              <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="确认新密码" className="input text-xs" />
              <div className="flex gap-2">
                <button onClick={handleChangePassword} className="btn-primary text-xs"><Key size={13} /> 确认修改</button>
                <button onClick={() => { setShowPasswordForm(false); setOldPassword(''); setNewPwd(''); setConfirmPwd(''); }} className="btn-ghost text-xs">取消</button>
              </div>
            </div>
          )}
        </div>

        {/* AI Config - Admin only */}
        {user.role === 'ADMIN' && (
          <>
            <div className="card">
              <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-secondary-900">
                <div className="w-7 h-7 bg-gradient-to-br from-violet-400 to-violet-600 rounded-lg flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                AI模型配置
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-600 mb-1.5">API Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="input text-sm" placeholder="sk-..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 mb-1.5">Base URL</label>
                    <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="input text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 mb-1.5">模型</label>
                    <select value={model} onChange={(e) => setModel(e.target.value)} className="input text-sm">
                      <option value="deepseek-chat">DeepSeek Chat</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o-mini</option>
                      <option value="qwen-plus">通义千问 Plus</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleSave} className="btn-primary text-sm"><Key size={15} /> 保存设置</button>
              </div>
            </div>

            {/* Account Management */}
            <div className="card">
              <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-secondary-900">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                  <Users size={14} className="text-white" />
                </div>
                账号管理
              </h3>
              <div className="mb-5 p-4 bg-secondary-50 rounded-xl space-y-3">
                <p className="text-xs font-medium text-secondary-600">创建子账号</p>
                <div className="grid grid-cols-3 gap-2">
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="邮箱" className="input text-xs" />
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="姓名" className="input text-xs" />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="密码" className="input text-xs" />
                </div>
                <button onClick={handleCreateAccount} className="btn-primary text-xs"><UserPlus size={14} /> 创建子账号</button>
              </div>
              <div className="space-y-2">
                {accounts.map((acc: any) => (
                  <div key={acc.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-secondary-800">
                        {acc.name}
                        <span className="text-xs text-secondary-400 ml-2">({acc.role === 'ADMIN' ? '主账号' : '子账号'})</span>
                      </p>
                      <p className="text-xs text-secondary-500">{acc.email}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="text-xs text-secondary-400 text-right mr-2">
                        <p>训练: {acc._count?.sessions || 0}</p>
                        <p>报告: {acc._count?.reports || 0}</p>
                      </div>
                      {acc.role !== 'ADMIN' && (
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingAccount(acc); setEditAccName(acc.name); setEditAccEmail(acc.email); setEditAccPassword(''); }}
                            className="p-1.5 rounded-lg hover:bg-secondary-100 text-secondary-400 hover:text-primary-600 transition-colors" title="编辑">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteAccount(acc.id)}
                            className="p-1.5 rounded-lg hover:bg-secondary-100 text-secondary-400 hover:text-danger transition-colors" title="删除">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {accounts.length === 0 && <p className="text-sm text-secondary-400 text-center py-4">暂无子账号</p>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Sub-account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center" onClick={() => setEditingAccount(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-lg max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-4">编辑账号</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-secondary-600 mb-1 block">姓名</label>
                <input value={editAccName} onChange={e => setEditAccName(e.target.value)} className="input text-sm" placeholder="姓名" />
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-600 mb-1 block">邮箱</label>
                <input value={editAccEmail} onChange={e => setEditAccEmail(e.target.value)} className="input text-sm" placeholder="邮箱" />
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-600 mb-1 block">新密码（留空不修改）</label>
                <input type="password" value={editAccPassword} onChange={e => setEditAccPassword(e.target.value)} className="input text-sm" placeholder="留空则不修改密码" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditingAccount(null)} className="btn-ghost text-sm">取消</button>
              <button onClick={handleEditAccount} className="btn-primary text-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
