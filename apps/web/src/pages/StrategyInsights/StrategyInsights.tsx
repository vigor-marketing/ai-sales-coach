import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Brain, TrendingUp, TrendingDown, Target, Repeat, Calendar, MessageSquare, Loader2, ChevronRight, ArrowLeft, ExternalLink } from 'lucide-react';
import api from '../../api/apiClient';

const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  sales_tactic: { label: '有效技巧', icon: TrendingUp, color: 'text-green-600 bg-green-50' },
  weakness: { label: '暴露弱点', icon: TrendingDown, color: 'text-red-600 bg-red-50' },
  success_pattern: { label: '有效应对', icon: Target, color: 'text-blue-600 bg-blue-50' },
  response_pattern: { label: '需要改进', icon: Repeat, color: 'text-amber-600 bg-amber-50' },
};

const CATEGORY_ORDER = ['sales_tactic', 'success_pattern', 'weakness', 'response_pattern'];

export default function StrategyInsights() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    api.get('/strategy').then(r => { setRoles(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const openDetail = async (role: any) => {
    setSelectedRole(role);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/strategy/${role.roleId}`);
      setDetail(res.data);
    } catch { setDetail(null); }
    setLoadingDetail(false);
  };

  if (selectedRole && detail) {
    const grouped: Record<string, any[]> = {};
    for (const ins of detail.insights || []) {
      if (!grouped[ins.category]) grouped[ins.category] = [];
      grouped[ins.category].push(ins);
    }

    return (
      <div className="animate-fade-in">
        {/* Back */}
        <button onClick={() => { setSelectedRole(null); setDetail(null); }}
          className="flex items-center gap-1 text-sm text-secondary-500 hover:text-secondary-700 mb-4 transition-colors">
          <ArrowLeft size={14} /> 返回列表
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-secondary-200 p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{selectedRole.roleName}</h2>
              <p className="text-xs text-secondary-500">{selectedRole.position} · {selectedRole.region}</p>
            </div>
            <div className="ml-auto flex items-center gap-3 text-xs text-secondary-500">
              <span>累计 {detail.totalSessions} 次对话</span>
              <span>{(detail.insights || []).length} 条洞察</span>
            </div>
          </div>
        </div>

        {/* Daily summaries — 可展开查看同一天的多场对话 */}
        {(detail.dailySummaries || []).length > 0 && (
          <div className="bg-white rounded-2xl border border-secondary-200 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-secondary-500" />
              <h3 className="text-sm font-semibold">对话记录</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {detail.dailySummaries.slice(0, 14).map((d: any) => (
                <div key={d.date} className="bg-secondary-50 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-secondary-700">{d.date.slice(5)}</span>
                    <Link to={`/reports?date=${d.date}`}
                      className="text-[10px] text-primary-500 hover:text-primary-700 hover:underline">
                      {d.sessionCount} 次
                    </Link>
                  </div>
                  {/* 同一天的多场对话分开展示 */}
                  {(d.sessions || []).length > 1 ? (
                    <div className="space-y-1">
                      {d.sessions.map((s: any, si: number) => (
                        <Link key={s.id} to={`/reports/${s.id}`}
                          className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-white/70 transition-colors text-[11px]">
                          <span className="text-secondary-500">#{si + 1}</span>
                          <span className="text-secondary-400">{new Date(s.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                          {s.score != null && (
                            <span className={`font-medium ${s.score >= 80 ? 'text-green-600' : s.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{s.score}分</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link to={`/reports?date=${d.date}`}
                      className="block px-2 py-1 text-[11px] text-secondary-500 rounded-lg hover:bg-white/70 transition-colors">
                      {d.summary || `共 ${d.sessionCount} 次对话`}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights grouped by category */}
        {CATEGORY_ORDER.map(cat => {
          const items = grouped[cat] || [];
          if (items.length === 0) return null;
          const meta = CATEGORY_META[cat] || { label: cat, icon: MessageSquare, color: 'text-secondary-600 bg-secondary-50' };
          const Icon = meta.icon;
          return (
            <div key={cat} className="bg-white rounded-2xl border border-secondary-200 p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                  <Icon size={14} />
                </div>
                <h3 className="text-sm font-semibold">{meta.label}</h3>
                <span className="text-[11px] text-secondary-400">({items.length}条)</span>
              </div>
              <div className="space-y-2">
                {items.slice().reverse().map((ins: any) => (
                  <div key={ins.id} className="p-3 bg-secondary-50 rounded-xl border border-secondary-100">
                    <p className="text-xs text-secondary-700 leading-relaxed">{ins.content}</p>
                    <p className="text-[10px] text-secondary-400 mt-1 flex items-center gap-1 flex-wrap">
                      {new Date(ins.createdAt).toLocaleDateString('zh-CN')} ·
                      {ins.sourceSessionId ? (
                        <Link to={`/reports/${ins.sourceSessionId}`} className="text-primary-500 hover:text-primary-700 hover:underline inline-flex items-center gap-0.5">
                          <ExternalLink size={10} />
                          查看报告
                        </Link>
                      ) : `会话 ${ins.sourceSessionId?.slice(0, 8)}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {(!detail.insights || detail.insights.length === 0) && (
          <div className="text-center py-12 text-secondary-400">
            <Brain size={40} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium">暂无策略洞察</p>
            <p className="text-xs mt-1">完成一次陪练并生成评估报告后，系统会自动分析对话并生成策略洞察</p>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-secondary-500"><Loader2 size={24} className="animate-spin mx-auto mb-2" />加载中...</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">策略洞察</h2>
          <p className="text-sm text-secondary-500 mt-1">查看每次对话后AI分析的策略优化建议</p>
        </div>
      </div>

      {roles.length === 0 ? (
        <div className="text-center py-16 text-secondary-400">
          <Brain size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">暂无策略数据</p>
          <p className="text-xs mt-1">完成一次陪练对话并生成评估报告后，策略洞察会自动生成</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {roles.map(r => (
            <div key={r.roleId} onClick={() => openDetail(r)}
              className="bg-white rounded-2xl border border-secondary-200 p-4 cursor-pointer hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shrink-0">
                  <Brain size={17} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{r.roleName}</h3>
                  <p className="text-xs text-secondary-500 truncate">{r.position} · {r.region}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-secondary-400">
                    <span>{r.totalSessions} 次对话</span>
                    <span>{r.insightCount} 条洞察</span>
                    {r.lastUpdated && <span>更新 {new Date(r.lastUpdated).toLocaleDateString('zh-CN')}</span>}
                  </div>
                  {r.recentInsights?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {r.recentInsights.map((ins: any, i: number) => (
                        <p key={i} className="text-[11px] text-secondary-500 truncate">
                          {ins.content}...
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight size={16} className="text-secondary-300 shrink-0 mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
