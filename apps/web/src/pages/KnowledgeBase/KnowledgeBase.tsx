import { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, X, Upload, FileText, Sparkles, Search, ChevronDown, ChevronUp, Edit2, Trash2, Loader2, Eye } from 'lucide-react';
import api from '../../api/apiClient';
import { quickCreateKnowledge, updateKnowledgeEntry, deleteKnowledgeEntry } from '../../api/apiClient';
import { showToast } from '../../components/Toast';

const CATEGORIES = ['销售技巧', '销售话术', '商务文化', '对话技巧', '对话样本', '客户关系', '行业知识', '产品知识', '上传文档'];

// 分类视觉配置
const CAT_VISUALS: Record<string, { emoji: string; accent: string; desc: string }> = {
  '商务文化': { emoji: '🌍', accent: 'border-l-amber-400', desc: '各国商务谈判方法与态度' },
  '销售技巧': { emoji: '🎯', accent: 'border-l-emerald-400', desc: '实战销售方法论' },
  '销售话术': { emoji: '💬', accent: 'border-l-blue-400', desc: '话术模板与示例' },
  '对话技巧': { emoji: '🔄', accent: 'border-l-violet-400', desc: '对话节奏与技巧' },
  '对话样本': { emoji: '📋', accent: 'border-l-cyan-400', desc: '完整的AI对话演示' },
  '上传文档': { emoji: '📄', accent: 'border-l-amber-500', desc: '上传的文档资料' },
  '客户关系': { emoji: '🤝', accent: 'border-l-rose-400', desc: '客户关系维护' },
  '行业知识': { emoji: '🏭', accent: 'border-l-slate-400', desc: '行业相关知识' },
  '产品知识': { emoji: '🔧', accent: 'border-l-orange-400', desc: '产品相关知识' },
};

/** 长内容组件 — 固定高度可滚动，带渐隐滚动提示 */
function ViewMoreContent({ content, entryId }: { content: string; entryId: string }) {
  const [showHint, setShowHint] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLong = content.length > 600;

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    if (atBottom) setShowHint(false);
  };

  // 检测内容中的标题行（## 或 ###），动态添加视觉分隔
  const renderContent = () => {
    const lines = content.split('\n');

    // 预处理：合并表格块（连续包含 | 的行）
    const blocks: { type: 'table' | 'line'; data: any }[] = [];
    let tableLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      const isTableLine = t.includes('|') && t.split('|').length >= 3;
      if (isTableLine) {
        tableLines.push(t);
      } else {
        if (tableLines.length > 0) {
          // 跳过第二行（分隔行 |---|---）
          const headerRow = tableLines[0];
          const bodyRows = tableLines.slice(2).filter(r => !r.match(/^[\s|:-]+$/));
          blocks.push({ type: 'table', data: { header: headerRow, rows: bodyRows } });
          tableLines = [];
        }
        blocks.push({ type: 'line', data: t });
      }
    }
    // 处理最后累积的表格行
    if (tableLines.length > 0) {
      const headerRow = tableLines[0];
      const bodyRows = tableLines.slice(2).filter(r => !r.match(/^[\s|:-]+$/));
      if (bodyRows.length > 0) {
        blocks.push({ type: 'table', data: { header: headerRow, rows: bodyRows } });
      }
    }

    return blocks.map((block, bi) => {
      if (block.type === 'table') {
        const cols = block.data.header.split('|').filter((c: string) => c.trim()).map((c: string) => c.trim());
        return (
          <div key={`t${bi}`} className="overflow-x-auto -mx-1 my-2">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-primary-50/80">
                  {cols.map((c: string, ci: number) => (
                    <th key={ci} className="px-2 py-1.5 text-left font-semibold text-primary-800 border border-primary-100 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.data.rows.map((row: string, ri: number) => {
                  const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => c.trim());
                  return (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-secondary-50/50'}>
                      {cells.map((cell: string, ci: number) => (
                        <td key={ci} className="px-2 py-1.5 text-secondary-700 border border-secondary-100 leading-relaxed">{cell}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      const trimmed = block.data;
      // ## 标题
      if (trimmed.startsWith('## ')) {
        return <div key={`l${bi}`} className="flex items-center gap-2 mt-3 mb-1.5"><div className="w-1 h-4 bg-primary-400 rounded-full shrink-0" /><span className="text-xs font-bold text-secondary-800">{trimmed.replace(/^##+\s*/, '')}</span></div>;
      }
      // ### 子标题
      if (trimmed.startsWith('### ')) {
        return <div key={`l${bi}`} className="flex items-center gap-1.5 mt-2 mb-1"><span className="text-[10px] text-primary-500 font-bold">▸</span><span className="text-[11px] font-semibold text-secondary-700">{trimmed.replace(/^###+\s*/, '')}</span></div>;
      }
      // 分隔线
      if (trimmed === '---' || trimmed === '___') {
        return <div key={`l${bi}`} className="border-t border-secondary-100 my-2" />;
      }
      // 列表项以 - 或 * 开头
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return <div key={`l${bi}`} className="flex items-start gap-1.5 ml-1"><span className="text-secondary-400 mt-0.5">•</span><span className="text-xs text-secondary-700 leading-relaxed">{trimmed.replace(/^[-*]\s*/, '')}</span></div>;
      }
      // ✅ ❌ 示例
      if (trimmed.startsWith('✅') || trimmed.startsWith('❌')) {
        const isGood = trimmed.startsWith('✅');
        return <div key={`l${bi}`} className={`flex items-start gap-1.5 ml-1 p-1.5 rounded-lg mt-1 ${isGood ? 'bg-emerald-50' : 'bg-red-50'}`}><span className="text-xs shrink-0">{trimmed.charAt(0)}</span><span className="text-xs leading-relaxed text-secondary-700">{trimmed.slice(1).trim()}</span></div>;
      }
      // 普通行
      if (trimmed) {
        return <div key={`l${bi}`} className="text-xs text-secondary-700 leading-relaxed">{trimmed}</div>;
      }
      return <div key={`l${bi}`} className="h-1" />;
    });
  };

  if (!isLong) {
    return <div className="text-xs text-secondary-700 leading-relaxed">{renderContent()}</div>;
  }

  return (
    <div>
      <div className="relative">
        <div ref={scrollRef} onScroll={handleScroll}
          className="overflow-y-auto max-h-[280px] pr-1 scrollbar-thin"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}>
          {renderContent()}
        </div>
        {showHint && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white via-white/70 to-transparent pointer-events-none" />
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-secondary-400">{Math.ceil(content.length / 100)} 段 · 滚动查看</span>
        {showHint && <span className="text-[10px] text-primary-400 animate-pulse">↓ 更多</span>}
      </div>
    </div>
  );
}

export default function KnowledgeBase() {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollToCard = (id: string) => {
    // 用 requestAnimationFrame 替代 setTimeout，消除卡顿
    requestAnimationFrame(() => cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [viewSourceId, setViewSourceId] = useState<string | null>(null);
  const [form, setForm] = useState({ question: '', answer: '', category: '', tags: '' });
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const toggleCat = (cat: string) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadText, setUploadText] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const load = () => { api.get('/knowledge/entries').then(r => { setEntries(r.data); setLoading(false); }).catch(() => { setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e =>
    !search || e.question?.toLowerCase().includes(search.toLowerCase()) ||
    e.category?.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => setForm({ question: '', answer: '', category: '', tags: '' });

  const handleCreateEntry = async () => {
    try {
      if (!form.question || !form.answer) return;
      await api.post('/knowledge/entries', form);
      setShowEntryForm(false);
      resetForm();
      load();
    } catch { alert('创建知识条目失败'); }
  };

  const handleEditEntry = async () => {
    try {
      if (!editingEntry || !form.question || !form.answer) return;
      await updateKnowledgeEntry(editingEntry.id, form);
      setEditingEntry(null);
      resetForm();
      load();
    } catch { alert('更新失败'); }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('确定删除此知识条目？')) return;
    try { await deleteKnowledgeEntry(id); load(); showToast('success', '知识条目已删除'); } catch { showToast('error', '删除失败，请重试'); }
  };

  // AI 内联生成（在新增条目弹窗里）
  const handleAiFill = async () => {
    const desc = form.question || prompt('输入一句话描述：');
    if (!desc) return;
    setAiLoading(true);
    try {
      const res = await quickCreateKnowledge(desc);
      const data = res.data;
      if (data.question) setForm(prev => ({ ...prev, question: data.question }));
      if (data.answer) setForm(prev => ({ ...prev, answer: data.answer }));
      if (data.category) setForm(prev => ({ ...prev, category: data.category }));
      if (data.tags) setForm(prev => ({ ...prev, tags: data.tags }));
    } catch { alert('AI生成失败'); }
    setAiLoading(false);
  };

  // 文档上传 + AI 摘要
  const handleUploadSummarize = async () => {
    if (!uploadFile) return;
    setSummaryLoading(true);
    try {
      const text = await uploadFile.text();
      setUploadText(text);
      // 调用 AI 总结
      const res = await api.post('/ai/quick-create-knowledge', { description: '总结以下文档内容并生成知识条目:\n' + text.substring(0, 3000) });
      const data = res.data;
      if (data.question && data.answer) {
        setSummaryText(data.answer);
        setForm({
          question: data.question || ('文档: ' + uploadFile.name),
          answer: data.answer || text.substring(0, 3000),
          category: data.category || '上传文档',
          tags: data.tags || '文档',
        });
      } else {
        // 如果AI总结失败，直接存原文摘要
        setSummaryText(text.substring(0, 2000));
        setForm({
          question: '文档: ' + uploadFile.name,
          answer: text.substring(0, 5000),
          category: '上传文档',
          tags: '文档',
        });
      }
    } catch {
      alert('文档处理失败，请重试');
    }
    setSummaryLoading(false);
  };

  const handleSaveUpload = async () => {
    if (!form.question || !form.answer) return;
    await api.post('/knowledge/entries', form);
    setShowUploadForm(false);
    setUploadFile(null);
    setUploadText('');
    setSummaryText('');
    resetForm();
    load();
  };

  const openEdit = (entry: any) => {
    setEditingEntry(entry);
    setForm({ question: entry.question || '', answer: entry.answer || '', category: entry.category || '', tags: entry.tags || '' });
  };

  if (loading) return <div className="p-8 text-center text-secondary-500"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />加载中...</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">知识库</h2>
          <p className="text-sm text-secondary-500 mt-1">销售知识与资料 · 共 {entries.length} 条</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowUploadForm(true); resetForm(); setUploadFile(null); setUploadText(''); setSummaryText(''); }} className="btn-secondary text-sm"><Upload size={16} /> 上传文档</button>
          <button onClick={() => { setShowEntryForm(true); setEditingEntry(null); resetForm(); }} className="btn-primary text-sm"><Plus size={16} /> 新增条目</button>
        </div>
      </div>

      {/* ===== 上传文档 Modal（含 AI 总结） ===== */}
      {showUploadForm && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUploadForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-soft-lg border border-secondary-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-secondary-100">
              <h3 className="text-lg font-bold text-secondary-900">上传文档</h3>
              <button onClick={() => setShowUploadForm(false)} className="p-1.5 rounded-lg hover:bg-secondary-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* 文件选择 */}
              <div className="border-2 border-dashed border-secondary-300 rounded-2xl p-6 text-center hover:border-primary-300 transition-colors">
                <Upload size={36} className="mx-auto mb-2 text-secondary-400" />
                <p className="text-sm text-secondary-600 mb-1">选择文档文件</p>
                <p className="text-xs text-secondary-400 mb-3">支持 TXT / PDF / Word</p>
                <input type="file" accept=".txt,.pdf,.doc,.docx" onChange={e => { setUploadFile(e.target.files?.[0] || null); setSummaryText(''); }} className="block mx-auto text-sm" />
                {uploadFile && (
                  <div className="mt-2 p-2 bg-primary-50 rounded-lg flex items-center gap-2 justify-center">
                    <FileText size={14} className="text-primary-600" />
                    <span className="text-xs text-primary-700 truncate">{uploadFile.name}</span>
                  </div>
                )}
              </div>

              {/* AI 总结按钮 */}
              {uploadFile && !summaryText && (
                <button onClick={handleUploadSummarize} disabled={summaryLoading}
                  className="btn-primary text-sm w-full flex items-center justify-center gap-1.5">
                  {summaryLoading ? <><Loader2 size={14} className="animate-spin" /> AI 正在总结...</> : <><Sparkles size={14} /> AI 智能总结</>}
                </button>
              )}
              {summaryLoading && <p className="text-xs text-secondary-400 text-center">正在分析文档内容，请稍候...</p>}

              {/* 总结预览 + 编辑 */}
              {summaryText && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 mb-1">标题</label>
                    <input value={form.question} onChange={e => setForm({...form, question: e.target.value})} className="input text-sm" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-secondary-600">摘要内容（可编辑）</label>
                      <button type="button" onClick={() => setForm({...form, answer: form.answer + '\n| 对方说… | 实际意思是… |\n|---|---|\n| | |'})}
                        className="text-[10px] text-primary-500 hover:text-primary-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-50 transition-colors">
                        ＋ 表格
                      </button>
                    </div>
                    <textarea value={form.answer} onChange={e => setForm({...form, answer: e.target.value})}
                      className="input text-sm w-full min-h-[200px] font-mono leading-relaxed"
                      style={{ resize: 'vertical' }} />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-secondary-400">{form.answer.length} 字</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-secondary-600 mb-1">分类</label>
                      <input value={form.category} list="cat-list-upload" onChange={e => setForm({...form, category: e.target.value})} className="input text-sm" placeholder="选择或输入分类" />
                      <datalist id="cat-list-upload">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary-600 mb-1">标签</label>
                      <input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="逗号分隔" className="input text-sm" />
                    </div>
                  </div>
                  {/* 查看源文件 */}
                  {uploadText && (
                    <details className="bg-secondary-50 rounded-xl p-3 border border-secondary-200">
                      <summary className="text-xs font-medium text-secondary-600 cursor-pointer hover:text-secondary-800 flex items-center gap-1.5">
                        <Eye size={14} /> 查看源文件原文
                      </summary>
                      <pre className="text-[11px] text-secondary-500 mt-2 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">{uploadText.substring(0, 3000)}{uploadText.length > 3000 ? '\n...(仅显示前3000字)' : ''}</pre>
                    </details>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-secondary-100 bg-secondary-50/50">
              <button onClick={() => setShowUploadForm(false)} className="btn-secondary text-sm">取消</button>
              <button onClick={handleSaveUpload} disabled={!form.question || !form.answer || !summaryText}
                className="btn-primary text-sm disabled:opacity-50">保存到知识库</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 新增/编辑条目 Modal（含 AI 内联生成） ===== */}
      {(showEntryForm || editingEntry) && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowEntryForm(false); setEditingEntry(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-soft-lg border border-secondary-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-secondary-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-secondary-900">{editingEntry ? '编辑知识条目' : '新增知识条目'}</h3>
              </div>
              <button onClick={() => { setShowEntryForm(false); setEditingEntry(null); }} className="p-1.5 rounded-lg hover:bg-secondary-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              {/* AI 快速填充 */}
              {!editingEntry && (
                <div className="bg-gradient-to-r from-purple-50 to-purple-100/60 border border-purple-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700">AI 智能生成</span>
                  </div>
                  <div className="flex gap-2">
                    <input value={form.question} onChange={e => setForm({...form, question: e.target.value})}
                      placeholder="输入问题/主题，AI自动填写内容..." className="input text-xs flex-1" />
                    <button onClick={handleAiFill} disabled={aiLoading || !form.question.trim()}
                      className="btn-primary text-xs shrink-0 px-3">
                      {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} 生成
                    </button>
                  </div>
                  {aiLoading && <p className="text-[10px] text-purple-500 mt-1">AI 正在生成，请稍候...</p>}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-secondary-600 mb-1">问题 / 标题</label>
                <input value={form.question} onChange={e => setForm({...form, question: e.target.value})} placeholder="例如：如何高效处理客户询盘？" className="input text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-secondary-600">答案 / 内容</label>
                  <button type="button" onClick={() => setForm({...form, answer: form.answer + '\n| 对方说… | 实际意思是… |\n|---|---|\n| | |'})}
                    className="text-[10px] text-primary-500 hover:text-primary-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-50 transition-colors">
                    ＋ 表格
                  </button>
                </div>
                <textarea value={form.answer} onChange={e => setForm({...form, answer: e.target.value})}
                  placeholder="输入答案内容..."
                  className="input text-sm w-full min-h-[300px] font-mono leading-relaxed"
                  style={{ resize: 'vertical' }} />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-secondary-400">{form.answer.length} 字</span>
                  <span className="text-[10px] text-secondary-400">表格格式: | 列1 | 列2 |</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-secondary-600 mb-1">分类</label>
                  <input value={form.category} list="cat-list" onChange={e => setForm({...form, category: e.target.value})} className="input text-sm" placeholder="选择或输入分类" />
                  <datalist id="cat-list">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-600 mb-1">标签</label>
                  <input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="逗号分隔" className="input text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-secondary-100 bg-secondary-50/50">
              <button onClick={() => { setShowEntryForm(false); setEditingEntry(null); }} className="btn-secondary text-sm">取消</button>
              <button onClick={editingEntry ? handleEditEntry : handleCreateEntry} className="btn-primary text-sm">{editingEntry ? '保存修改' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <div className="relative max-w-md mx-auto md:mx-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索知识条目（标题/内容/标签）..."
            className="w-full input pl-10 pr-10 text-sm bg-white/80 border-secondary-200 focus:border-primary-300 focus:ring-2 focus:ring-primary-100/60 transition-all rounded-xl" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-300 hover:text-secondary-500">
              <X size={14} />
            </button>
          )}
        </div>
        {filtered.length > 0 && search && (
          <p className="text-[11px] text-secondary-400 mt-1.5 text-center md:text-left">
            找到 <span className="text-primary-600 font-medium">{filtered.length}</span> 条结果
          </p>
        )}
      </div>

      {/* Cards — 分类折叠展示 */}
      {(() => {
        const grouped = {}; filtered.forEach(e => { const c = e.category || '未分类'; if (!grouped[c]) grouped[c] = []; grouped[c].push(e); });
        const order = ['商务文化', '销售技巧', '销售话术', '对话技巧', '对话样本', '上传文档'];
        const cats = order.filter(c => grouped[c]).concat(Object.keys(grouped).filter(c => !order.includes(c)));
        if (cats.length === 0) return <div className="text-center py-12 text-secondary-400"><BookOpen size={48} className="mx-auto mb-3 opacity-30" /><p className="font-medium">知识库为空</p><p className="text-xs mt-1">新增条目或上传文档</p></div>;
        return cats.map((cat, ci) => {
          const isOpen = expandedCats[cat] !== false; // 默认展开第一个分类
          return (
            <div key={cat} className="mb-4">
              {/* 分类大标题 — 可点击展开/折叠 */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-50 to-primary-100/40 border border-primary-200 rounded-xl cursor-pointer hover:shadow-sm hover:border-primary-300 transition-all select-none group"
                onClick={() => toggleCat(cat)}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${isOpen ? 'scale-100' : 'scale-95 group-hover:scale-100'}`}
                  style={{ background: `hsl(${(ci * 45 + 200) % 360}, 55%, 45%)` }}>
                  <span className="text-lg">{CAT_VISUALS[cat]?.emoji || '📚'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-secondary-900">{cat}</h3>
                    <span className="text-[11px] bg-white/70 text-secondary-400 px-2 py-0.5 rounded-full font-medium">{grouped[cat].length} 条</span>
                  </div>
                  <p className="text-[11px] text-secondary-500 mt-0.5">{CAT_VISUALS[cat]?.desc || '相关知识'}</p>
                </div>
                <div className={`flex items-center gap-1.5 text-xs text-secondary-400 bg-white/60 px-3 py-1.5 rounded-full shrink-0 transition-all ${isOpen ? 'bg-primary-100/60 text-primary-600' : 'group-hover:bg-secondary-100'}`}>
                  <span>{isOpen ? '收起' : '展开'}</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {/* 卡片列表 — 折叠/展开 */}
              <div className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  {grouped[cat].map((entry: any) => {
                    const sel = selectedEntryId === entry.id;
                    const doc = entry.category === '上传文档';
                    return (
                    <div key={entry.id} ref={el => { if (el) cardRefs.current.set(entry.id, el); }}
                      className={`card cursor-pointer relative border-l-4 ${CAT_VISUALS[entry.category]?.accent || 'border-l-primary-400'} ${sel ? 'ring-2 ring-primary-500 shadow-md bg-white' : 'hover:shadow-md hover:bg-white/90 bg-white/70'}`}
                      onClick={() => { const was = sel; setSelectedEntryId(was ? null : entry.id); if (!was) scrollToCard(entry.id); }}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-[13px]">{CAT_VISUALS[entry.category]?.emoji || '📌'}</span>
                          <span className="text-[11px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-medium shrink-0">{entry.category}</span>
                          {entry.tags && entry.tags !== '[]' && entry.tags !== '' && (
                            <span className="text-[10px] text-secondary-400 bg-secondary-100 px-1.5 py-0.5 rounded-full truncate max-w-[100px] hidden sm:inline">
                              {entry.tags.replace(/[\[\]"]/g, '').split(',')[0]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {/* 编辑/删除按钮 — 始终显示在右侧，和展开箭头不重叠 */}
                          <div className="flex gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); openEdit(entry); }}
                              className="p-1 rounded-lg hover:bg-primary-50" title="编辑">
                              <Edit2 size={11} className="text-secondary-400 hover:text-primary-500" />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteEntry(entry.id); }}
                              className="p-1 rounded-lg hover:bg-red-50" title="删除">
                              <Trash2 size={11} className="text-secondary-400 hover:text-red-500" />
                            </button>
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${sel ? 'bg-primary-100 text-primary-600' : 'text-secondary-300'}`}>
                            {sel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                      </div>
                      <h3 className="font-semibold text-secondary-900 text-sm mb-1.5 leading-snug">{entry.question}</h3>
                      {sel ? (
                        <div className="animate-slide-up border-t border-secondary-100 pt-3 mt-2">
                          {doc ? (
                            // 文档：直接展示全部
                            <>
                              <div className="text-xs text-secondary-700 leading-relaxed whitespace-pre-wrap">{entry.answer}</div>
                              <button onClick={e => { e.stopPropagation(); setViewSourceId(viewSourceId === entry.id ? null : entry.id); }} className="mt-2 text-[10px] text-primary-500 hover:underline flex items-center gap-1"><Eye size={12} /> {viewSourceId === entry.id ? '收起原文' : '查看源文件'}</button>
                              {viewSourceId === entry.id && <div className="mt-2 bg-amber-50 border rounded-lg p-3"><pre className="text-[10px] text-amber-800 whitespace-pre-wrap max-h-32 overflow-y-auto">{entry.answer}</pre></div>}
                            </>
                          ) : entry.answer && entry.answer.length > 600 ? (
                            // 长内容（商务文化等）：默认折叠，点击展开
                            <ViewMoreContent content={entry.answer} entryId={entry.id} />
                          ) : (
                            <div className="text-xs text-secondary-700 leading-relaxed whitespace-pre-wrap">{entry.answer}</div>
                          )}
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-secondary-600 leading-relaxed line-clamp-2">{entry.answer?.substring(0, 150)}...</p>
                          {/* 底部信息条 */}
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-secondary-50">
                            <span className="text-[10px] text-secondary-400">{Math.ceil((entry.answer?.length || 0) / 100)} 段</span>
                            {entry.tags && entry.tags !== '[]' && entry.tags !== '' && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {entry.tags.replace(/[\[\]"]/g, '').split(',').slice(0, 2).map((t: string, i: number) => (
                                  <span key={i} className="text-[9px] bg-secondary-100 text-secondary-500 px-1.5 py-0.5 rounded-full">{t.trim()}</span>
                                ))}
                                {entry.tags.replace(/[\[\]"]/g, '').split(',').length > 2 && (
                                  <span className="text-[9px] text-secondary-400">+{entry.tags.replace(/[\[\]"]/g, '').split(',').length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}
