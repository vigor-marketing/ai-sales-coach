import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Award, AlertTriangle, ChevronRight, ArrowLeft, Users, FileText } from 'lucide-react';
import { getAnalytics } from '../../api/apiClient';

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getAnalytics().then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Helpers ──
  const scoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = (s: number) => s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const scoreLabel = (s: number) => s >= 80 ? '优秀' : s >= 60 ? '良好' : s >= 40 ? '需加强' : '待提升';

  if (loading) return (
    <div className="p-8 text-center text-secondary-500">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      分析中...
    </div>
  );

  if (!data || data.overview.totalReports === 0) return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg hover:bg-secondary-100 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">跨会话分析</h2>
          <p className="text-sm text-secondary-500 mt-1">暂无数据，完成陪练后自动生成</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-secondary-200 p-16 text-center text-secondary-400">
        <BarChart3 size={56} className="mx-auto mb-4 opacity-30" />
        <p className="font-medium">暂无分析数据</p>
        <p className="text-sm mt-1">完成至少一次陪练，评估报告产生后即可查看跨会话分析</p>
        <button onClick={() => navigate('/training')} className="btn-primary text-sm mt-4 px-5 py-2">开始陪练</button>
      </div>
    </div>
  );

  const { overview, roleAnalytics, scenarioAnalytics, dimensionAverages, scoreTrend } = data;

  // Compute trend moving average for smoother chart
  const trendWithAvg = scoreTrend.map((d: any, i: number) => {
    const window = scoreTrend.slice(Math.max(0, i - 2), i + 1);
    const avg = Math.round(window.reduce((a: number, b: any) => a + b.score, 0) / window.length);
    return { ...d, movingAvg: avg };
  });
  const maxTrendScore = Math.max(...scoreTrend.map((d: any) => d.score), 80);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg hover:bg-secondary-100 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">跨会话分析</h2>
          <p className="text-sm text-secondary-500 mt-1">基于 {overview.totalReports} 份评估报告的综合分析</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-secondary-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-secondary-500 text-xs mb-1"><FileText size={14} /> 总报告数</div>
          <p className="text-xl font-bold text-secondary-900">{overview.totalReports}</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-secondary-500 text-xs mb-1"><Award size={14} /> 平均分</div>
          <p className={`text-xl font-bold ${scoreColor(overview.averageScore)}`}>{overview.averageScore}</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-green-600 text-xs mb-1"><TrendingUp size={14} /> 最高分</div>
          <p className="text-xl font-bold text-green-600">{overview.bestScore}</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-red-600 text-xs mb-1"><AlertTriangle size={14} /> 最低分</div>
          <p className="text-xl font-bold text-red-600">{overview.worstScore}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* ── Role Weaknesses ── */}
        <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-secondary-100 bg-secondary-50/50">
            <h3 className="text-sm font-bold text-secondary-900 flex items-center gap-2"><Users size={16} /> 角色弱项排行</h3>
            <p className="text-[10px] text-secondary-400 mt-0.5">按平均分从低到高排列，优先关注底部角色</p>
          </div>
          <div className="p-3 space-y-2 max-h-[350px] overflow-y-auto">
            {roleAnalytics.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${i < 3 ? 'bg-red-500' : 'bg-secondary-300'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-secondary-900 truncate">{r.role}</span>
                    <span className={`text-xs font-bold ml-2 ${scoreColor(r.avgScore)}`}>{r.avgScore}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-secondary-400 mt-0.5">
                    <span>{r.position}</span>
                    <span>· {r.count}次</span>
                  </div>
                  <div className="w-full bg-secondary-200 rounded-full h-1.5 mt-1">
                    <div className={`h-1.5 rounded-full ${scoreBg(r.avgScore)}`} style={{ width: `${r.avgScore}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scenario Weaknesses ── */}
        <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-secondary-100 bg-secondary-50/50">
            <h3 className="text-sm font-bold text-secondary-900 flex items-center gap-2"><FileText size={16} /> 场景弱项排行</h3>
            <p className="text-[10px] text-secondary-400 mt-0.5">按平均分从低到高排列，优先关注底部场景</p>
          </div>
          <div className="p-3 space-y-2 max-h-[350px] overflow-y-auto">
            {scenarioAnalytics.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${i < 3 ? 'bg-red-500' : 'bg-secondary-300'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-secondary-900 truncate">{s.scenario}</span>
                    <span className={`text-xs font-bold ml-2 ${scoreColor(s.avgScore)}`}>{s.avgScore}</span>
                  </div>
                  <div className="text-[10px] text-secondary-400 mt-0.5">{s.count}次训练</div>
                  <div className="w-full bg-secondary-200 rounded-full h-1.5 mt-1">
                    <div className={`h-1.5 rounded-full ${scoreBg(s.avgScore)}`} style={{ width: `${s.avgScore}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dimension Averages ── */}
      <div className="bg-white rounded-xl border border-secondary-200 mb-6">
        <div className="px-4 py-3 border-b border-secondary-100 bg-secondary-50/50">
          <h3 className="text-sm font-bold text-secondary-900 flex items-center gap-2"><BarChart3 size={16} /> 各维度平均分</h3>
          <p className="text-[10px] text-secondary-400 mt-0.5">跨所有会话，查看销售能力的强项和弱项</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dimensionAverages.map((d: any, i: number) => (
            <div key={i} className="bg-secondary-50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-secondary-700">{d.dimension}</span>
                <span className={`text-xs font-bold ${scoreColor(d.avgScore)}`}>{d.avgScore}</span>
              </div>
              <div className="w-full bg-secondary-200 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${scoreBg(d.avgScore)}`} style={{ width: `${d.avgScore}%` }} />
              </div>
              <p className="text-[10px] text-secondary-400 mt-1">{d.count}次评估</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Score Trend ── */}
      {trendWithAvg.length >= 2 && (
        <div className="bg-white rounded-xl border border-secondary-200 mb-6">
          <div className="px-4 py-3 border-b border-secondary-100 bg-secondary-50/50">
            <h3 className="text-sm font-bold text-secondary-900 flex items-center gap-2"><TrendingUp size={16} /> 分数趋势</h3>
            <p className="text-[10px] text-secondary-400 mt-0.5">每次训练分数变化，红线为3次移动平均</p>
          </div>
          <div className="p-4">
            <div className="relative h-32 sm:h-36">
              <svg viewBox={`0 0 ${Math.max(trendWithAvg.length * 60, 200)} 140`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                {/* Y-axis labels */}
                {[0, 25, 50, 75, 100].map(v => {
                  const y = 120 - (v / 100) * 100;
                  return (
                    <g key={v}>
                      <line x1="0" y1={y} x2="100%" y2={y} stroke="#f3f4f6" strokeWidth="1" />
                      <text x="-5" y={y + 3} textAnchor="end" fontSize="8" fill="#9ca3af">{v}</text>
                    </g>
                  );
                })}
                {/* Score dots */}
                {trendWithAvg.map((d: any, i: number) => {
                  const x = i * 60 + 30;
                  const y = 120 - (d.score / 100) * 100;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r="3" fill={d.score >= 80 ? '#22c55e' : d.score >= 60 ? '#eab308' : '#ef4444'} />
                    </g>
                  );
                })}
                {/* Moving average line */}
                {trendWithAvg.length >= 3 && (
                  <polyline
                    points={trendWithAvg.map((d: any, i: number) => `${i * 60 + 30},${120 - (d.movingAvg / 100) * 100}`).join(' ')}
                    fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,3" opacity="0.6"
                  />
                )}
                <line x1="0" y1="120" x2="100%" y2="120" stroke="#e5e7eb" strokeWidth="1" />
                {/* Date labels */}
                {trendWithAvg.filter((_: any, i: number) => i % Math.max(1, Math.floor(trendWithAvg.length / 6)) === 0 || i === trendWithAvg.length - 1).map((d: any, i: number) => {
                  const idx = trendWithAvg.indexOf(d);
                  return (
                    <text key={i} x={idx * 60 + 30} y="132" textAnchor="middle" fontSize="7" fill="#9ca3af">{d.date.slice(5)}</text>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Recommended actions */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
        <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2"><AlertTriangle size={16} /> 重点关注</h3>
        <ul className="space-y-1.5">
          {roleAnalytics.length > 0 && roleAnalytics[0].avgScore < 60 && (
            <li className="text-xs text-amber-700">🔴 角色「{roleAnalytics[0].role}」平均分仅 {roleAnalytics[0].avgScore}，需要重点练习</li>
          )}
          {scenarioAnalytics.length > 0 && scenarioAnalytics[0].avgScore < 60 && (
            <li className="text-xs text-amber-700">🔴 场景「{scenarioAnalytics[0].scenario}」平均分仅 {scenarioAnalytics[0].avgScore}，建议多加训练</li>
          )}
          {dimensionAverages.length > 0 && dimensionAverages[0].avgScore < 60 && (
            <li className="text-xs text-amber-700">💡 「{dimensionAverages[0].dimension}」维度是整体弱项（{dimensionAverages[0].avgScore}分），建议针对性练习</li>
          )}
          {trendWithAvg.length >= 3 && trendWithAvg[trendWithAvg.length - 1].movingAvg < trendWithAvg[0].movingAvg && (
            <li className="text-xs text-amber-700">📉 分数趋势下降，建议调整训练策略</li>
          )}
          {roleAnalytics.length > 0 && scenarioAnalytics.length > 0 && dimensionAverages.length > 0 && (
            <li className="text-xs text-amber-700">✅ 完成更多训练后分析将更准确，建议每周至少完成 2-3 次陪练</li>
          )}
        </ul>
      </div>

      {/* Bottom nav */}
      <div className="flex justify-between items-center pt-4 border-t border-secondary-200 mb-8">
        <button onClick={() => navigate('/reports')} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
          <ArrowLeft size={16} /> 返回报告列表
        </button>
        <button onClick={() => navigate('/training')} className="btn-primary text-xs sm:text-sm px-4 py-2">
          开始陪练
        </button>
      </div>
    </div>
  );
}
