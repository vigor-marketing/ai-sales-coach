import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, ThumbsUp, ThumbsDown, MessageSquare, Zap, TrendingUp, Download, BarChart3, ChevronRight, Award, XCircle, HelpCircle, Target, FileText } from 'lucide-react';
import { getReport, getReports } from '../../api/apiClient';

interface Dimension {
  dimension: string; score: number; positivePoints: string[]; negativePoints: string[]; feedback: string;
}

interface ReportData {
  id: string; overallScore: number; radarData: string; strengths: string; weaknesses: string;
  recommendations: string; createdAt: string;
  orderAwarded: boolean; orderReason: string; orderType: string;
  session: { role: { name: string; position: string; region: string }; scenario: { title: string } | null; messages: { role: string; content: string }[] };
}

function RadarChart({ dims }: { dims: Dimension[] }) {
  const n = dims.length; if (!n) return null;
  const cx = 160, cy = 160, r = 120;
  const point = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + (r * v / 100) * Math.cos(a), y: cy + (r * v / 100) * Math.sin(a) };
  };
  const colors = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6'];

  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-[300px] mx-auto">
      {[1,2,3,4,5].map(l => {
        const pts = dims.map((_,i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return `${cx + r * l / 5 * Math.cos(a)},${cy + r * l / 5 * Math.sin(a)}`; }).join(' ');
        return <polygon key={l} points={pts} fill="none" stroke="#e5e7eb" strokeWidth={1} />;
      })}
      {dims.map((_,i) => { const p = point(i,100); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth={1} />; })}
      <polygon points={dims.map((d,i) => { const p = point(i,d.score); return `${p.x},${p.y}`; }).join(' ')} fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth={2} />
      {dims.map((d,i) => { const p = point(i,d.score); return <circle key={i} cx={p.x} cy={p.y} r={4.5} fill={colors[i%n]} />; })}
      {dims.map((d,i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2, lr = r + 22;
        return (
          <g key={`l${i}`}>
            <text x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a)} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#6b7280">{d.dimension}</text>
            <text x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a) + 13} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight="bold" fill={colors[i%n]}>{d.score}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ScoreBadge({ score }: { score: number }) {
  let c = 'bg-red-100 text-red-700';
  if (score >= 80) c = 'bg-green-100 text-green-700';
  else if (score >= 60) c = 'bg-amber-100 text-amber-700';
  else if (score >= 40) c = 'bg-orange-100 text-orange-700';
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c}`}>{score}分</span>;
}

export default function ReportDetail() {
  const { id } = useParams(); const navigate = useNavigate();
  const [report, setReport] = useState<ReportData | null>(null);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getReport(id).then(r => {
      setReport(r.data);
      // Also fetch all reports for trend chart
      getReports().then(res => {
        if (Array.isArray(res.data)) {
          setAllReports(res.data.filter((rep: any) => rep.overallScore > 0).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
        }
      }).catch(() => {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center">加载中...</div>;
  if (!report) return <div className="p-8 text-center">报告不存在</div>;

  // Helper: render text as numbered items (splits by digits like "1." "2.")
  const renderNumberedItems = (text: string, color: 'green' | 'red') => {
    if (!text || !text.trim()) return <p className="text-xs text-gray-500">暂无数据</p>;
    const dotColor = color === 'green' ? 'bg-green-500' : 'bg-red-500';
    const items = text.split(/\n|(?=\d+[.、])/).filter((l: string) => l.trim() && l.trim().length > 5);
    if (items.length <= 1) {
      return <p className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line">{text}</p>;
    }
    return (
      <div className="space-y-2">
        {items.map((line, i) => {
          const content = line.replace(/^\s*\d+[.、]\s*/, '').trim();
          if (!content) return null;
          return (
            <div key={i} className="flex gap-2">
              <span className={`w-4 h-4 ${dotColor} text-white rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5`}>{i+1}</span>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{content}</p>
            </div>
          );
        })}
      </div>
    );
  };

  // Parse dimensions and sort by score ascending (A: weakest first)
  let dims: Dimension[] = [];
  try { 
    const parsed = JSON.parse(report.radarData);
    dims = Array.isArray(parsed) ? parsed : [];
  } catch {}
  dims = [...dims].sort((a, b) => a.score - b.score); // A: sort by score ascending

  const avg = dims.length ? Math.round(dims.reduce((s,d) => s + d.score, 0) / dims.length) : report.overallScore;
  const lowest = dims.length ? dims[0] : null; // first after sorting
  const highest = dims.length ? dims[dims.length - 1] : null; // last after sorting

  // B: Compute conversation stats
  const msgs = report.session?.messages || [];
  const salesMsgs = msgs.filter(m => m.role === 'USER');
  const clientMsgs = msgs.filter(m => m.role === 'ASSISTANT');
  const questionsAsked = salesMsgs.filter(m => m.content.trim().endsWith('?')).length;
  const certMentions = salesMsgs.filter(m => /\b(API|ISO|NORSOK|ASME|DNV)\b/i.test(m.content)).length;
  const objectionKeywords = ['never heard', 'not satisfied', 'too expensive', 'not what', 'vague', 'not convinced', 'concern', 'problem'];
  const objections = clientMsgs.filter(m => objectionKeywords.some(k => m.content.toLowerCase().includes(k))).length;

  // C: Generate weakest dimension improvement tip
  const weakTips: Record<string, string> = {
    '话术规范性': '每次开口前先用「三段式结构」：确认对方需求 → 提供具体信息 → 询问反馈。避免泛泛承诺。',
    '业务知识': '对话前花5分钟复习该客户地区的行业标准（API/ISO/NORSOK）和竞品信息，准备3个核心数据。',
    '沟通技巧': '多用开放性问题（What/How/Why），少用封闭性问题（Yes/No）。让客户多说，你多听。',
    '需求挖掘': '准备一个「必问清单」：1. 您的具体应用场景？2. 当前供应商的痛点？3. 预算范围？4. 决策流程？',
    '异议处理': '面对异议时用「LAA法」：Listen（听完）→ Acknowledge（认可合理性）→ Answer（用数据/案例回应）。',
    '流程覆盖': '每次对话结束前主动推进到下一步，约定下次沟通的具体时间，如技术会议或电话沟通。',
  };

  const handleDownload = async () => {
    try {
      const original = reportRef.current;
      if (!original) return;

      // Clone and prepare for PDF
      const clone = original.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
      clone.querySelectorAll('[class*="max-h"]').forEach(el => (el as HTMLElement).style.maxHeight = 'none');
      clone.querySelectorAll('.line-clamp-2, .truncate').forEach(el => {
        (el as HTMLElement).classList.remove('line-clamp-2', 'truncate');
      });
      // Keep SVG and content, remove interactive buttons
      clone.querySelectorAll('button, [onclick]').forEach(el => el.remove());

      // Place clone far below viewport (visible to html2canvas but not to user)
      clone.style.position = 'absolute';
      clone.style.left = '0';
      clone.style.top = '10000px';
      clone.style.width = '750px';
      clone.style.background = 'white';
      clone.style.opacity = '1';
      clone.style.zIndex = '-1';
      document.body.appendChild(clone);

      // Wait for rendering
      await new Promise(r => setTimeout(r, 1000));

      const jsPDF = (await import('jspdf')).default;
      const html2canvas = (await import('html2canvas')).default;

      // Capture the entire clone as a single canvas
      const canvas = await html2canvas(clone, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: clone.scrollWidth,
        height: clone.scrollHeight,
      });

      // Remove clone
      document.body.removeChild(clone);

      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `AI陪练_培训报告_${dateStr}.pdf`;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const margin = 10;

      const imgRatio = canvas.width / canvas.height;
      const totalH = pdfW / imgRatio;
      let yPos = 0;

      while (yPos < totalH) {
        const pageH = Math.min(pdfH - margin * 2, totalH - yPos);
        const cropY = (yPos / totalH) * canvas.height;
        const cropH = (pageH / totalH) * canvas.height;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = cropH;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, -cropY);
        const pageImg = pageCanvas.toDataURL('image/jpeg', 0.92);

        if (yPos > 0) pdf.addPage();
        pdf.addImage(pageImg, 'JPEG', margin, margin, pdfW - margin * 2, pageH);
        yPos += pageH;
      }

      pdf.save(filename);
    } catch (e) {
      console.error('Download error:', e);
    }
  };

  // E: Trend chart data
  const trendData = allReports.length >= 2 ? allReports.map(r => ({
    date: new Date(r.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    score: r.overallScore,
    isCurrent: r.id === report.id,
  })) : [];

  return (
    <div className="max-w-full px-1 sm:px-2 lg:px-4" ref={reportRef}>
      <div id="report-content" style={{ display: 'contents' }}>
      {/* Top Nav */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-secondary-600 hover:text-secondary-900">
          <ArrowLeft size={18} /> 返回
        </button>
        <button onClick={handleDownload} className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm py-1.5 px-3">
          <Download size={14} /> 下载报告
        </button>
      </div>

      {/* Hero Banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-blue-200 text-xs sm:text-sm">评估报告</p>
            <h2 className="text-lg sm:text-2xl font-bold mt-0.5 truncate">{report.session?.scenario?.title || '通用场景'}</h2>
            <p className="text-blue-200 text-xs sm:text-sm mt-1 truncate">{report.session?.role?.name} · {report.session?.role?.position} · {report.session?.role?.region}</p>
            <p className="text-blue-300 text-xs mt-1">{new Date(report.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center bg-white/10 rounded-xl px-4 py-2 sm:px-6 sm:py-3">
              <div className="text-3xl sm:text-5xl font-bold">{report.overallScore}</div>
              <div className="text-blue-200 text-xs mt-0.5">总分</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
          <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium mb-1"><TrendingUp size={14} /> 最强项</div>
          <p className="text-sm font-semibold text-green-800 truncate">{highest?.dimension || '-'}</p>
          <span className="text-xs text-green-600">{highest?.score || '-'}分</span>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <div className="flex items-center gap-1.5 text-red-700 text-xs font-medium mb-1"><AlertTriangle size={14} /> 最弱项</div>
          <p className="text-sm font-semibold text-red-800 truncate">{lowest?.dimension || '-'}</p>
          <span className="text-xs text-red-600">{lowest?.score || '-'}分</span>
        </div>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <div className="flex items-center gap-1.5 text-blue-700 text-xs font-medium mb-1"><BarChart3 size={14} /> 平均分</div>
          <p className="text-sm font-semibold text-blue-800">{avg}</p>
          <span className="text-xs text-blue-600">{dims.length}个维度</span>
        </div>
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
          <div className="flex items-center gap-1.5 text-purple-700 text-xs font-medium mb-1"><MessageSquare size={14} /> 对话轮次</div>
          <p className="text-sm font-semibold text-purple-800">{salesMsgs.length}</p>
          <span className="text-xs text-purple-600">销售发言{salesMsgs.length}轮</span>
        </div>
      </div>

      {/* Score Color Legend */}
      <div className="flex items-center gap-3 mb-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> 优秀(80+)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> 良好(60-79)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> 及格(40-59)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> 需加强(&lt;40)</span>
      </div>

      {/* Order Decision */}
      <div className={'rounded-xl border-2 mb-4 sm:mb-6 overflow-hidden ' + (report.orderType === '正式订单' ? 'border-green-300' : report.orderType === '预订单' ? 'border-blue-300' : 'border-red-300')}>
        <div className={(report.orderType === '正式订单' ? 'bg-green-50 border-green-200' : report.orderType === '预订单' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200') + ' px-3 sm:px-4 py-3 border-b'}>
          <h3 className={'text-sm font-bold flex items-center gap-2 ' + (report.orderType === '正式订单' ? 'text-green-800' : report.orderType === '预订单' ? 'text-blue-800' : 'text-red-800')}>
            {report.orderType === '正式订单' ? <Award size={17} /> : report.orderType === '预订单' ? <Award size={17} /> : <XCircle size={17} />}
            客户采购决策
          </h3>
        </div>
        <div className="p-3 sm:p-4 bg-white">
          <div className="flex items-center gap-3 mb-3">
            {report.orderType === '正式订单' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                <Award size={16} /> 🏆 正式订单
              </span>
            ) : report.orderType === '预订单' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                <Award size={16} /> 📋 预订单
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                <XCircle size={16} /> ✗ 丢单
              </span>
            )}
          </div>
          {report.orderReason ? (
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line">{report.orderReason}</p>
          ) : (
            <p className="text-xs text-gray-500 italic">暂无决策原因</p>
          )}
        </div>
      </div>

      {/* C: Weakest dimension improvement callout */}
      {lowest && lowest.score < 60 && (
        <div className="rounded-xl bg-orange-50 border-2 border-orange-300 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-orange-800">重点改进：{lowest.dimension}</h4>
              <p className="text-xs text-orange-700 mt-1 leading-relaxed">{weakTips[lowest.dimension] || '建议针对该维度进行专项练习，在下次对话中有意识地加强'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Radar + Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-xl bg-white border border-gray-200 p-3 sm:p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">多维度雷达图</h3>
          {dims.length > 0 ? <RadarChart dims={dims} /> : (
            <div className="text-center py-8 text-secondary-500">
              <BarChart3 size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">暂无维度评分数据</p>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-white border border-gray-200 p-3 sm:p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">各维度评分（从低到高）</h3>
          {dims.length > 0 ? (
          <div className="space-y-3">
            {dims.map((d,i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 truncate flex items-center gap-1.5">
                    {i === 0 && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                    {d.dimension}
                  </span>
                  <ScoreBadge score={d.score} />
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${d.score}%`, backgroundColor: d.score >= 80 ? '#22c55e' : d.score >= 60 ? '#eab308' : d.score >= 40 ? '#f97316' : '#ef4444' }} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{d.feedback}</p>
              </div>
            ))}
          </div>
          ) : (
            <div className="text-center py-8 text-secondary-500">
              <BarChart3 size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">AI评估响应格式异常，无维度评分</p>
              <p className="text-[11px] text-secondary-400 mt-1">报告内容可在下方查看</p>
            </div>
          )}
        </div>
      </div>

      {/* Dimensional Analysis */}
      <div className="mb-4 sm:mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" /> 逐项详细分析
        </h3>
        {dims.length > 0 ? (
        <div className="space-y-2 sm:space-y-3">
          {dims.map((d,i) => {
            const colors = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6'];
            return (
              <details key={i} className="rounded-xl bg-white border border-gray-200 overflow-hidden group">
                <summary className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-1.5 h-8 sm:w-2 sm:h-10 rounded-full shrink-0" style={{ backgroundColor: colors[i % 6] }} />
                    <div className="min-w-0">
                      <span className="text-sm sm:text-base font-semibold text-gray-900">{d.dimension}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{d.feedback}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-base sm:text-lg font-bold ${d.score >= 80 ? 'text-green-600' : d.score >= 60 ? 'text-amber-600' : d.score >= 40 ? 'text-orange-600' : 'text-red-600'}`}>{d.score}</span>
                    <ChevronRight size={16} className="text-gray-400 transition-transform duration-200 group-open:rotate-90" />
                  </div>
                </summary>
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3 border-t border-gray-100 pt-3">
                  {d.positivePoints?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-1.5"><ThumbsUp size={13} /> 得分项</div>
                      <ul className="space-y-1">{d.positivePoints.map((p,j) => <li key={j} className="text-xs text-gray-600 pl-2.5 border-l-2 border-green-400 leading-relaxed">{p}</li>)}</ul>
                    </div>
                  )}
                  {d.negativePoints?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 mb-1.5"><ThumbsDown size={13} /> 扣分项</div>
                      <ul className="space-y-1">{d.negativePoints.map((p,j) => <li key={j} className="text-xs text-gray-600 pl-2.5 border-l-2 border-red-400 leading-relaxed">{p}</li>)}</ul>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
        ) : (
          <div className="text-center py-8 text-secondary-500 rounded-xl bg-white border border-gray-200">
            <BarChart3 size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">AI评估响应格式异常，无维度分析数据</p>
          </div>
        )}
      </div>

      {/* Transcript */}
      <details className="rounded-xl bg-white border border-gray-200 mb-4 sm:mb-6 group">
        <summary className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-900">对话回顾</span>
            <span className="text-xs text-gray-400">({msgs.length}条消息)</span>
          </div>
          <ChevronRight size={16} className="text-gray-400 transition-transform duration-200 group-open:rotate-90" />
        </summary>
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 border-t border-gray-100 pt-3">
          {msgs.map((m,i) => (
            <div key={i} className={`p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm leading-relaxed ${m.role === 'USER' ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-gray-50 border-l-4 border-gray-400'}`}>
              <span className="font-semibold text-xs block mb-0.5">{m.role === 'USER' ? '👤 销售代表' : '🤖 客户'}</span>
              <p className="text-gray-700 whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
        </div>
      </details>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-xl bg-white border-l-4 border-green-500 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium mb-2"><TrendingUp size={15} /> 优点</div>
          {renderNumberedItems(report.strengths, 'green')}
        </div>
        <div className="rounded-xl bg-white border-l-4 border-red-500 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-red-700 text-xs font-medium mb-2"><ThumbsDown size={15} /> 不足</div>
          {renderNumberedItems(report.weaknesses, 'red')}
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-xl bg-white border-2 border-amber-300 mb-4 sm:mb-6">
        <div className="bg-amber-50 px-3 sm:px-4 py-3 border-b border-amber-200">
          <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2"><Zap size={17} /> 具体改进建议</h3>
        </div>
        <div className="p-3 sm:p-4 space-y-3">
          {(report.recommendations || '').trim() ? (
            (() => {
              // Split by numbered patterns like "1." "2." "3." or "1、" "2、"
              const raw = report.recommendations;
              const items = raw.split(/\n|(?=\d+[.、])/).filter((l: string) => l.trim() && l.trim().length > 5);
              return items.map((line: string, i: number) => {
                const text = line.replace(/^\s*\d+[.、]\s*/, '').trim();
                if (!text) return null;
                return (
                  <div key={i} className="flex gap-2.5 sm:gap-3">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i+1}</span>
                    <p className="text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-line">{text}</p>
                  </div>
                );
              });
            })()
          ) : (
            <div className="text-center py-8 text-secondary-500">
              <Zap size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无改进建议数据</p>
            </div>
          )}
        </div>
      </div>

      {/* E: Score Trend Chart */}
      {trendData.length >= 2 ? (
        <div className="rounded-xl bg-white border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp size={16} /> 历史分数趋势</h3>
          <div className="relative h-28 sm:h-32">
            <svg viewBox="0 0 {trendData.length * 60} 120" className="w-full h-full" preserveAspectRatio="none">
              {/* Y axis lines */}
              <line x1="0" y1="0" x2={trendData.length * 60} y2="0" stroke="#f0f0f0" strokeWidth="1" />
              <line x1="0" y1="30" x2={trendData.length * 60} y2="30" stroke="#f0f0f0" strokeWidth="1" />
              <line x1="0" y1="60" x2={trendData.length * 60} y2="60" stroke="#f0f0f0" strokeWidth="1" />
              <line x1="0" y1="90" x2={trendData.length * 60} y2="90" stroke="#f0f0f0" strokeWidth="1" />
              {/* Line */}
              <polyline
                points={trendData.map((d, i) => `${i * 60 + 30},${120 - d.score * 1.2}`).join(' ')}
                fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round"
              />
              {/* Dots */}
              {trendData.map((d, i) => (
                <g key={i}>
                  <circle cx={i * 60 + 30} cy={120 - d.score * 1.2} r={d.isCurrent ? 6 : 4}
                    fill={d.isCurrent ? '#3b82f6' : '#93c5fd'} stroke="white" strokeWidth="2" />
                  {d.isCurrent && (
                    <text x={i * 60 + 30} y={120 - d.score * 1.2 - 10} textAnchor="middle" fontSize="10" fill="#3b82f6" fontWeight="bold">
                      {d.score}
                    </text>
                  )}
                </g>
              ))}
              {/* Date labels */}
              {trendData.filter((_, i) => i % Math.max(1, Math.floor(trendData.length / 5)) === 0 || i === trendData.length - 1).map((d, i) => (
                <text key={i} x={trendData.indexOf(d) * 60 + 30} y="115" textAnchor="middle" fontSize="8" fill="#9ca3af">{d.date}</text>
              ))}
            </svg>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 sm:p-5 mb-4 sm:mb-6 text-center">
          <TrendingUp size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-xs text-gray-500">完成多次陪练后，这里将显示你的分数变化趋势</p>
          <button onClick={() => navigate('/training')} className="btn-primary text-xs mt-3 px-4 py-2">开始新的陪练</button>
        </div>
      )}

      {/* Bottom Nav */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-gray-200 mb-8">
        <button onClick={() => navigate('/reports')} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
          <ArrowLeft size={16} /> 返回报告列表
        </button>
        <button onClick={() => navigate('/training')} className="btn-primary text-xs sm:text-sm w-full sm:w-auto text-center">
          开始新的陪练
        </button>
      </div>
      </div>
    </div>
  );
}
