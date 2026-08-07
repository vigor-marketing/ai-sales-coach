import { useState, useEffect } from 'react';
import { MessageCircle, Bug, Lightbulb, Sparkles, HelpCircle, CheckCircle, Clock, Search, Loader2 } from 'lucide-react';
import api from '../../api/apiClient';

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  BUG: { label: 'Bug', icon: Bug, color: 'text-red-500 bg-red-50' },
  FEATURE: { label: '功能建议', icon: Lightbulb, color: 'text-amber-500 bg-amber-50' },
  IMPROVEMENT: { label: '改进意见', icon: Sparkles, color: 'text-blue-500 bg-blue-50' },
  OTHER: { label: '其他', icon: HelpCircle, color: 'text-secondary-500 bg-secondary-50' },
};

const STATUS_OPTS = ['PENDING', 'REVIEWING', 'RESOLVED', 'CLOSED'];
const STATUS_LABEL: Record<string, string> = { PENDING: '待处理', REVIEWING: '处理中', RESOLVED: '已解决', CLOSED: '已关闭' };
const STATUS_COLOR: Record<string, string> = { PENDING: 'bg-amber-100 text-amber-700', REVIEWING: 'bg-blue-100 text-blue-700', RESOLVED: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-100 text-gray-500' };

export default function FeedbackAdmin() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    api.get('/feedback').then(r => { setFeedbacks(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const handleStatusChange = async (id: string, status: string) => {
    setUpdating(id);
    try { await api.put(`/feedback/${id}`, { status }); load(); } catch { alert('更新失败'); }
    setUpdating(null);
  };

  const filtered = feedbacks.filter(f =>
    (!search || f.content?.toLowerCase().includes(search.toLowerCase()) || f.contact?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterType || f.type === filterType) &&
    (!filterStatus || f.status === filterStatus)
  );

  const pendingCount = feedbacks.filter(f => f.status === 'PENDING').length;

  if (loading) return <div className="p-8 text-center text-secondary-500"><Loader2 size={24} className="animate-spin mx-auto mb-2" />加载中...</div>;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">反馈管理</h2>
          <p className="text-sm text-secondary-500 mt-1">
            {pendingCount > 0
              ? <span className="text-amber-600 font-medium">有 {pendingCount} 条待处理反馈</span>
              : '暂无待处理反馈'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索反馈内容..." className="input text-sm pl-8" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input text-sm w-auto">
          <option value="">全部类型</option>
          <option value="BUG">Bug</option><option value="FEATURE">功能建议</option>
          <option value="IMPROVEMENT">改进意见</option><option value="OTHER">其他</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input text-sm w-auto">
          <option value="">全部状态</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(f => {
          const meta = TYPE_META[f.type] || TYPE_META.OTHER;
          const Icon = meta.icon;
          return (
            <div key={f.id} className="bg-white rounded-2xl border border-secondary-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[f.status]}`}>
                        {STATUS_LABEL[f.status]}
                      </span>
                      <span className="text-[11px] text-secondary-400">{meta.label}</span>
                      <span className="text-[11px] text-secondary-300">·</span>
                      <span className="text-[11px] text-secondary-400">{new Date(f.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      {f.contact && <><span className="text-[11px] text-secondary-300">·</span><span className="text-[11px] text-secondary-400">📧 {f.contact}</span></>}
                    </div>
                    <p className="text-sm text-secondary-800 mt-1.5 whitespace-pre-wrap">{f.content}</p>
                    {f.userId && <p className="text-[10px] text-secondary-400 mt-0.5">用户ID: {f.userId.slice(0, 8)}...</p>}
                  </div>
                </div>
                <div className="shrink-0">
                  <select value={f.status}
                    onChange={e => handleStatusChange(f.id, e.target.value)}
                    disabled={updating === f.id}
                    className="input text-xs py-1 px-2 w-24 disabled:opacity-50"
                  >
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-secondary-400">
            <MessageCircle size={40} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium">{feedbacks.length === 0 ? '暂无反馈' : '无匹配结果'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
