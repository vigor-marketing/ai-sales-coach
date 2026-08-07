import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Award, TrendingUp, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, User, Trash2, BarChart3, X, CheckSquare, Square, ArrowLeft } from 'lucide-react';
import { getReports, getReport, deleteReport } from '../../api/apiClient';
import { useAuthStore } from '../../stores/authStore';

export default function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState<Record<string, any>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    getReports().then((res) => {
      setReports(Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadDetail = async (id: string) => {
    if (reportDetails[id]) return;
    setLoadingDetail(id);
    try {
      const res = await getReport(id);
      setReportDetails(prev => ({ ...prev, [id]: res.data }));
    } catch (e) { console.error(e); }
    setLoadingDetail(null);
  };

  const toggleSelect = (id: string) => {
    if (selectedId === id) { setSelectedId(null); return; }
    setSelectedId(id);
    loadDetail(id);
  };

  const toggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    // Load detail if not yet loaded
    if (!reportDetails[id]) loadDetail(id);
  };

  const openCompare = () => {
    // Load all report details first
    compareIds.forEach(id => { if (!reportDetails[id]) loadDetail(id); });
    setShowCompare(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定删除此报告？关联的对话记录也将一并删除，此操作不可撤销。')) return;
    try {
      await deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      console.error(err);
      alert('删除失败，请重试');
    }
  };

  const scoreInfo = (score: number) => {
    if (score >= 90) return { color: 'text-green-600', bg: 'bg-green-100', badge: 'bg-green-100 text-green-700', label: '优秀', bar: 'bg-green-500' };
    if (score >= 80) return { color: 'text-blue-600', bg: 'bg-blue-100', badge: 'bg-blue-100 text-blue-700', label: '良好', bar: 'bg-blue-500' };
    if (score >= 70) return { color: 'text-amber-600', bg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700', label: '及格', bar: 'bg-amber-500' };
    if (score >= 60) return { color: 'text-orange-600', bg: 'bg-orange-100', badge: 'bg-orange-100 text-orange-700', label: '需加强', bar: 'bg-orange-500' };
    return { color: 'text-red-600', bg: 'bg-red-100', badge: 'bg-red-100 text-red-700', label: '不合格', bar: 'bg-red-500' };
  };

  if (loading) return <div className="p-8 text-center text-secondary-500"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />加载中...</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">评估报告</h2>
          <p className="text-sm text-secondary-500 mt-1">查看陪练评估与改进建议</p>
        </div>
        <div className="flex items-center gap-3">
          {compareIds.length > 0 && (
            <button onClick={openCompare} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-sm shadow-primary-200">
              <BarChart3 size={14} /> 对比 {compareIds.length} 份
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-secondary-400">
            <FileText size={14} /> 共 {reports.length} 份
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-secondary-200 p-16 text-center text-secondary-400">
            <FileText size={56} className="mx-auto mb-4 opacity-30" />
            <p className="font-medium">暂无评估记录</p>
            <p className="text-sm mt-1">完成一次陪练后会自动生成报告</p>
          </div>
        )}
        {reports.map((r) => {
          const si = scoreInfo(r.overallScore ?? 0);
          const isSelected = selectedId === r.id;
          const detail = reportDetails[r.id];
          let dims: any[] = [];
          try { if (detail?.radarData) dims = JSON.parse(detail.radarData); } catch {}
          const inCompare = compareIds.includes(r.id);

          return (
            <div key={r.id} className="relative">
              {/* Compare checkbox */}
              <div className="absolute top-2.5 left-2.5 z-10">
                <button onClick={(e) => toggleCompare(r.id, e)}
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${inCompare ? 'bg-primary-600 text-white' : 'bg-white/80 border border-secondary-300 text-secondary-400 hover:border-primary-400'}`}>
                  {inCompare ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
              </div>

              <div
                className={`bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200
                  ${isSelected ? 'border-primary-500 shadow-md shadow-primary-100' : 'border-secondary-200 hover:border-secondary-300 hover:shadow-sm'}
                  ${inCompare ? 'ring-2 ring-primary-400' : ''}`}
                onClick={() => toggleSelect(r.id)}
              >
                {/* Card header */}
                <div className="flex items-start gap-3 pl-7">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${si.bg}`}>
                    <Award size={20} className={si.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-secondary-900 text-sm truncate">{r.session?.scenario?.title || '通用场景'}</h3>
                      {isSelected ? <ChevronUp size={16} className="text-primary-500 shrink-0" /> : <ChevronDown size={16} className="text-secondary-300 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-lg font-bold ${si.color}`}>{r.overallScore ?? '-'}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${si.badge}`}>{si.label}</span>
                      {r.orderType === '正式订单' ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700 ml-auto">🏆 正式订单</span>
                      ) : r.orderType === '预订单' ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 ml-auto">📋 预订单</span>
                      ) : r.orderAwarded === false ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-50 text-red-500 ml-auto">✗ 丢单</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-secondary-500">
                      <span className="flex items-center gap-1"><TrendingUp size={11} /> {r.session?.role?.name || '未知'}</span>
                      <span className="flex items-center gap-1"><Calendar size={11} /> {r.createdAt ? new Date(r.createdAt).toLocaleDateString('zh-CN') : '-'}</span>
                      {isAdmin && (
                        <span className="flex items-center gap-1 ml-auto"><User size={11} /> {r.session?.user?.name || '未知'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-secondary-100 animate-slide-up">
                    {loadingDetail === r.id ? (
                      <div className="text-center py-4 text-xs text-secondary-400">
                        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />加载中...
                      </div>
                    ) : detail ? (
                      <div className="space-y-3">
                        {dims.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {dims.map((d: any, i: number) => (
                              <div key={i} className="p-2.5 bg-secondary-50 rounded-xl">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs text-secondary-600">{d.dimension}</span>
                                  <span className={`text-xs font-bold ${d.score >= 80 ? 'text-green-600' : d.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{d.score}</span>
                                </div>
                                <div className="w-full bg-secondary-200 rounded-full h-1.5">
                                  <div className={`h-1.5 rounded-full transition-all ${d.score >= 80 ? 'bg-green-500' : d.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${d.score}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          {detail.strengths && (
                            <div className="p-2.5 bg-green-50 rounded-xl border border-green-100">
                              <div className="flex items-center gap-1 text-xs text-green-700 font-medium mb-1"><ThumbsUp size={12} /> 优点</div>
                              <p className="text-xs text-green-800 leading-relaxed line-clamp-3">{detail.strengths}</p>
                            </div>
                          )}
                          {detail.weaknesses && (
                            <div className="p-2.5 bg-red-50 rounded-xl border border-red-100">
                              <div className="flex items-center gap-1 text-xs text-red-700 font-medium mb-1"><ThumbsDown size={12} /> 不足</div>
                              <p className="text-xs text-red-800 leading-relaxed line-clamp-3">{detail.weaknesses}</p>
                            </div>
                          )}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/reports/${r.id}`); }}
                          className="w-full py-2 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors">查看完整报告 →</button>
                        {isAdmin && (
                          <button onClick={(e) => handleDelete(r.id, e)}
                            className="w-full py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                            <Trash2 size={13} /> 删除此报告
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-secondary-400">暂无详细数据</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Compare Modal */}
      {showCompare && (
        <CompareModal
          ids={compareIds}
          details={reportDetails}
          reports={reports}
          onClose={() => setShowCompare(false)}
          navigate={navigate}
        />
      )}
    </div>
  );
}

/* ─── Compare Modal ─── */
function CompareModal({ ids, details, reports, onClose, navigate }: {
  ids: string[];
  details: Record<string, any>;
  reports: any[];
  onClose: () => void;
  navigate: any;
}) {
  const loadedDetails = ids.map(id => details[id]).filter(Boolean);
  const compareReports = ids.map(id => reports.find(r => r.id === id)).filter(Boolean);

  // Collect all dimension names
  const allDimNames: string[] = [];
  loadedDetails.forEach((d: any) => {
    try {
      const dims = JSON.parse(d.radarData || '[]');
      dims.forEach((dim: any) => {
        if (!allDimNames.includes(dim.dimension)) allDimNames.push(dim.dimension);
      });
    } catch {}
  });

  const dimColors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 overflow-y-auto bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl mx-4 mb-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-secondary-200">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-primary-600" />
            <h3 className="text-base font-bold text-secondary-900">报告对比</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary-100 flex items-center justify-center text-secondary-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-6">
          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-secondary-200">
                  <th className="text-left py-2 pr-4 text-secondary-500 font-medium">维度</th>
                  {compareReports.map((r: any, i: number) => {
                    const si = scoreInfoStatic(r.overallScore ?? 0);
                    return (
                      <th key={i} className="text-center py-2 px-2 min-w-[100px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-lg font-bold ${si.color}`}>{r.overallScore ?? '-'}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${si.badge}`}>{si.label}</span>
                          <span className="text-[10px] text-secondary-400 truncate max-w-[100px]">{r.session?.role?.name || ''}</span>
                          <span className="text-[9px] text-secondary-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('zh-CN') : ''}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allDimNames.map((dimName, rowIdx) => (
                  <tr key={dimName} className={`border-b border-secondary-100 ${rowIdx % 2 === 0 ? 'bg-secondary-50/50' : ''}`}>
                    <td className="py-2.5 pr-4 text-secondary-700 font-medium whitespace-nowrap">{dimName}</td>
                    {loadedDetails.map((d: any, colIdx: number) => {
                      let score = '-';
                      try {
                        const dims = JSON.parse(d.radarData || '[]');
                        const matched = dims.find((x: any) => x.dimension === dimName);
                        if (matched) score = matched.score;
                      } catch {}
                      const numScore = typeof score === 'number' ? score : parseInt(score);
                      const isNum = !isNaN(numScore);
                      return (
                        <td key={colIdx} className="text-center py-2.5 px-2">
                          {isNum ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-sm font-bold ${numScore >= 80 ? 'text-green-600' : numScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{numScore}</span>
                              <div className="w-16 bg-secondary-200 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${numScore >= 80 ? 'bg-green-500' : numScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(numScore, 100)}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-secondary-400">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mini comparison charts: side by side */}
          {loadedDetails.length >= 2 && allDimNames.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-secondary-500 mb-3 uppercase tracking-wider">各维度得分对比</h4>
              <div className="space-y-2">
                {allDimNames.map((dimName, idx) => {
                  const scores = loadedDetails.map((d: any) => {
                    try {
                      const dims = JSON.parse(d.radarData || '[]');
                      const matched = dims.find((x: any) => x.dimension === dimName);
                      return matched ? matched.score : 0;
                    } catch { return 0; }
                  });
                  const maxScore = Math.max(...scores);
                  return (
                    <div key={dimName} className="flex items-center gap-3">
                      <span className="text-xs text-secondary-600 w-20 shrink-0 truncate" title={dimName}>{dimName}</span>
                      <div className="flex-1 flex gap-1 h-5 items-end">
                        {scores.map((s: number, i: number) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <span className="text-[9px] font-medium" style={{ color: dimColors[i % dimColors.length] }}>{s}</span>
                            <div
                              className="w-full rounded-t transition-all"
                              style={{
                                height: `${Math.max((s / (maxScore || 100)) * 20, 4)}px`,
                                backgroundColor: dimColors[i % dimColors.length],
                                opacity: 0.8
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <span className="text-[9px] text-secondary-400 w-12 text-right">{maxScore}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order decision comparison */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {compareReports.map((r: any, i: number) => (
              <div key={i} className="bg-secondary-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-secondary-500 mb-1">{r.session?.role?.name || '未知'}</p>
                <p className="text-sm font-semibold text-secondary-900">
                  {r.orderType === '正式订单' ? '🏆 正式订单' :
                   r.orderType === '预订单' ? '📋 预订单' :
                   r.orderAwarded === false ? '✗ 丢单' : '—'}
                </p>
              </div>
            ))}
          </div>

          {/* View full reports */}
          <div className="flex flex-wrap gap-2 justify-center pt-2 border-t border-secondary-100">
            {compareReports.map((r: any, i: number) => (
              <button key={i} onClick={() => { onClose(); navigate(`/reports/${r.id}`); }}
                className="text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <FileText size={12} /> {r.session?.role?.name || '报告'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function scoreInfoStatic(score: number) {
  if (score >= 90) return { color: 'text-green-600', bg: 'bg-green-100', badge: 'bg-green-100 text-green-700', label: '优秀', bar: 'bg-green-500' };
  if (score >= 80) return { color: 'text-blue-600', bg: 'bg-blue-100', badge: 'bg-blue-100 text-blue-700', label: '良好', bar: 'bg-blue-500' };
  if (score >= 70) return { color: 'text-amber-600', bg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700', label: '及格', bar: 'bg-amber-500' };
  if (score >= 60) return { color: 'text-orange-600', bg: 'bg-orange-100', badge: 'bg-orange-100 text-orange-700', label: '需加强', bar: 'bg-orange-500' };
  return { color: 'text-red-600', bg: 'bg-red-100', badge: 'bg-red-100 text-red-700', label: '不合格', bar: 'bg-red-500' };
}
