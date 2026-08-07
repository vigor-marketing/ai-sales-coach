import { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, X, Search, ChevronDown, ChevronUp, Wand2, Loader2, Sparkles, Pencil } from 'lucide-react';
import api, { createScenario, updateScenario, deleteScenario, quickCreateScenario } from '../../api/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { showToast } from '../../components/Toast';
import { SkeletonGrid } from '../../components/Skeleton';

const KNOWN_REGIONS = ['', '中东', '欧洲', '北美', '俄罗斯', '南美', '澳洲', '东南亚', '日本', '中亚', '中国', '印度', '通用'];

// 场景分类 Emoji 映射
const SCENARIO_EMOJI: Record<string, string> = {
  '初次接触': '🤝', '初次接触/破冰': '🤝', '破冰': '🤝', '展会': '🎪',
  '需求挖掘': '🔍', '需求分析': '🔍',
  '方案呈现': '📊', '方案展示': '📊', '方案介绍': '📊',
  '技术评审': '🔬', '技术澄清': '🔬', '技术方案评审': '🔬', '技术方案': '🔬', '技术验证': '🔬',
  '异议处理': '💪', '价格异议': '💪',
  '谈判签约': '✍️', '价格谈判': '✍️', '谈判': '✍️', '签约': '✍️',
  '紧急交货': '🚨', '危机投诉': '🚨', '危机': '🚨', '紧急': '🚨',
  '关系建立': '🤝', '关系维护': '🤝',
  '战略合作': '🤝',
  '商务拜访': '🏢',
  '认证审核': '📋', '认证': '📋',
  '技术会议': '🎥', '视频会议': '🎥',
};

const getScenarioEmoji = (title: string) => {
  for (const [key, emoji] of Object.entries(SCENARIO_EMOJI)) {
    if (title.includes(key)) return emoji;
  }
  return '📌';
};

const REGION_COLORS: Record<string, string> = {
  '中东': 'bg-amber-100 text-amber-700',
  '欧洲': 'bg-indigo-100 text-indigo-700',
  '北美': 'bg-blue-100 text-blue-700',
  '俄罗斯': 'bg-purple-100 text-purple-700',
  '中国': 'bg-red-100 text-red-700',
  '印度': 'bg-amber-100 text-amber-700',
  '南美': 'bg-emerald-100 text-emerald-700',
  '澳洲': 'bg-cyan-100 text-cyan-700',
  '东南亚': 'bg-teal-100 text-teal-700',
  '日本': 'bg-pink-100 text-pink-700',
  '中亚': 'bg-yellow-100 text-yellow-700',
  '通用': 'bg-gray-100 text-gray-600',
};

type FormData = { title: string; description: string; category: string; difficulty: string; background: string; objectives: string; evaluationCriteria: string; region: string };

const EMPTY_FORM: FormData = { title: '', description: '', category: '', difficulty: 'MEDIUM', background: '', objectives: '', evaluationCriteria: '', region: '' };

export default function ScenarioManager() {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollToCard = (id: string) => {
    requestAnimationFrame(() => cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [quickDesc, setQuickDesc] = useState('');
  const [quickCreating, setQuickCreating] = useState(false);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const load = () => { api.get('/scenarios').then(r => { setScenarios(r.data); setLoading(false); }).catch(() => { setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const filtered = scenarios.filter(s =>
    !search || s.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const handleQuickCreate = async () => {
    if (!quickDesc.trim()) {
      alert('请输入场景描述');
      return;
    }
    setQuickCreating(true);
    try {
      const res = await quickCreateScenario(quickDesc.trim());
      if (res?.data) {
        setForm({
          title: res.data.title || '',
          description: res.data.description || '',
          category: res.data.category || '',
          difficulty: res.data.difficulty || 'MEDIUM',
          background: res.data.background || '',
          objectives: res.data.objectives || '',
          evaluationCriteria: res.data.evaluationCriteria || '',
          region: res.data.region || '',
        });
        setQuickDesc('');
        setShowForm(true);
      }
    } catch (err) {
      console.error('Quick create error:', err);
      alert('AI快速创建失败，请重试');
    }
    setQuickCreating(false);
  };

  const openEdit = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setForm({
      title: s.title || '',
      description: s.description || '',
      category: s.category || '',
      difficulty: s.difficulty || 'MEDIUM',
      background: s.background || '',
      objectives: s.objectives || '',
      evaluationCriteria: s.evaluationCriteria || '',
      region: s.region || '',
    });
    setSelected(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title) {
      alert('请填写场景标题');
      return;
    }
    try {
      if (editingId) {
        await updateScenario(editingId, form);
      } else {
        await createScenario(form);
      }
      setShowForm(false);
      setEditingId(null);
      load();
    } catch (err) {
      console.error('error:', err);
      alert(editingId ? '更新场景失败' : '创建场景失败');
    }
  };

  const handleAiGenerate = async () => {
    if (!form.title) {
      alert('请至少填写标题后再使用AI生成');
      return;
    }
    setAiGenerating(true);
    try {
      const res = await api.post('/ai/generate-scenario-fields', form);
      setForm(prev => ({
        ...prev,
        description: res.data.description || prev.description,
        background: res.data.background || prev.background,
        objectives: res.data.objectives || prev.objectives,
        evaluationCriteria: res.data.evaluationCriteria || prev.evaluationCriteria,
      }));
    } catch (err) {
      console.error('AI generate error:', err);
      alert('AI生成失败，请重试');
    }
    setAiGenerating(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    try {
      e.stopPropagation();
      if (!confirm('确定删除此场景？')) return;
      await deleteScenario(id);
      setSelected(null);
      load();
      showToast('success', '场景已删除');
    } catch (err) {
      console.error('error:', err);
      showToast('error', '删除失败，请重试');
    }
  };

  const diffColor = (d: string) => {
    const map: Record<string, string> = {
      EASY: 'bg-green-100 text-green-700', MEDIUM: 'bg-blue-100 text-blue-700',
      HARD: 'bg-amber-100 text-amber-700', EXPERT: 'bg-red-100 text-red-700',
    };
    return map[d] || 'bg-secondary-100 text-secondary-600';
  };

  if (loading) return <div className="p-8"><SkeletonGrid count={4} /></div>;

  return (
    <div className="animate-fade-in">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">场景管理</h2>
          <p className="text-sm text-secondary-500 mt-1">管理陪练对话场景 — 创建、编辑或删除场景，确保每个地区的角色都有场景推荐</p>
        </div>
        {isAdmin ? <button onClick={openCreate} className="btn-primary text-sm"><Plus size={16} /> 新增场景</button> : null}
      </div>

      {/* 搜索 */}
      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索场景..." className="input pl-9 text-sm" />
      </div>

      {/* 创建 / 编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-lg border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center"><Sparkles size={16} className="text-white" /></div>
                <h3 className="text-lg font-bold">{editingId ? '编辑场景' : '新建场景'}</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-secondary-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              {/* AI 快速创建 */}
              {!editingId && (
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-violet-600" />
                      <span className="text-xs font-semibold text-violet-700">AI 智能快速创建</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-violet-500 mb-2">输入一段简单描述，AI自动生成完整场景，你再精细调整</p>
                  <div className="flex gap-2">
                    <input value={quickDesc} onChange={e => setQuickDesc(e.target.value)}
                      placeholder="如：东南亚钻井承包商的价格谈判场景，客户预算有限需要灵活付款"
                      className="input text-sm flex-1" />
                    <button onClick={handleQuickCreate} disabled={quickCreating || !quickDesc.trim()}
                      className="btn-primary text-xs px-3 py-1.5 shrink-0 disabled:opacity-50 flex items-center gap-1.5">
                      {quickCreating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                      {quickCreating ? '生成中...' : '智能创建'}
                    </button>
                  </div>
                </div>
              )}

              {/* 基础字段 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><label className="text-xs text-secondary-500 mb-1 block">标题 *</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="如：技术方案评审 - 说服技术型客户" className="input text-sm" /></div>
                <div><label className="text-xs text-secondary-500 mb-1 block">分类</label><input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="如：技术沟通" className="input text-sm" /></div>
                <div><label className="text-xs text-secondary-500 mb-1 block">难度</label>
                  <select value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})} className="input text-sm">
                    <option value="EASY">简单</option><option value="MEDIUM">中等</option><option value="HARD">困难</option><option value="EXPERT">专家</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-secondary-500 mb-1 block">地区</label>
                  <input list="region-list-s" value={form.region} onChange={e => setForm({...form, region: e.target.value})}
                    placeholder="选择或输入地区，如：中东" className="input text-sm" />
                  <datalist id="region-list-s">
                    {KNOWN_REGIONS.filter(r => r).map(r => <option key={r} value={r} />)}
                  </datalist>
                  <p className="text-[11px] text-secondary-400 mt-1">下拉选择或手动输入。选择后该地区的角色会优先推荐此场景。</p>
                </div>
              </div>

              {/* AI 智能生成区域 */}
              <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-4 border border-primary-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 size={16} className="text-primary-600" />
                    <span className="text-xs font-semibold text-primary-700">AI 智能生成</span>
                  </div>
                  <button onClick={handleAiGenerate} disabled={aiGenerating || !form.title}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 flex items-center gap-1.5">
                    {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    {aiGenerating ? '生成中...' : '一键生成'}
                  </button>
                </div>
                <p className="text-[11px] text-primary-500 mb-2">根据标题和分类自动生成描述、背景、目标和评估标准</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-primary-600 font-medium mb-1 block">场景描述（AI生成）</label>
                    <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                      className="input text-xs h-14" placeholder="点击「一键生成」自动填充，也可手动修改" />
                  </div>
                  <div>
                    <label className="text-[11px] text-primary-600 font-medium mb-1 block">背景设定（AI生成）</label>
                    <textarea value={form.background} onChange={e => setForm({...form, background: e.target.value})}
                      className="input text-xs h-14" placeholder="点击「一键生成」自动填充，也可手动修改" />
                  </div>
                  <div>
                    <label className="text-[11px] text-primary-600 font-medium mb-1 block">对话目标（AI生成）</label>
                    <textarea value={form.objectives} onChange={e => setForm({...form, objectives: e.target.value})}
                      className="input text-xs h-14" placeholder="点击「一键生成」自动填充，也可手动修改" />
                  </div>
                  <div>
                    <label className="text-[11px] text-primary-600 font-medium mb-1 block">评估标准（AI生成）</label>
                    <textarea value={form.evaluationCriteria} onChange={e => setForm({...form, evaluationCriteria: e.target.value})}
                      className="input text-xs h-14" placeholder="点击「一键生成」自动填充，也可手动修改" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t bg-secondary-50">
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">取消</button>
              <button onClick={handleSave} className="btn-primary text-sm">{editingId ? '保存修改' : '创建场景'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 场景列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {filtered.map((s) => {
          const isSelected = selected === s.id;
          return (
            <div key={s.id} ref={el => { if (el) cardRefs.current.set(s.id, el); }}
              className={`bg-white rounded-2xl border border-secondary-200 p-4 cursor-pointer transition-all duration-200 ${isSelected ? 'ring-2 ring-primary-500 shadow-md' : 'hover:shadow-md'}`}
              onClick={() => { const was = isSelected; setSelected(was ? null : s.id); if (!was) scrollToCard(s.id); }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    s.difficulty === 'EASY' ? 'bg-green-50' : s.difficulty === 'MEDIUM' ? 'bg-blue-50' : s.difficulty === 'HARD' ? 'bg-amber-50' : 'bg-red-50'
                  }`}>
                    <span className="text-lg">{getScenarioEmoji(s.title)}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-secondary-900 text-sm truncate">{s.title}</h3>
                    <p className="text-xs text-secondary-500 truncate mt-0.5">{s.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 地区标签 */}
                  {s.region && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${REGION_COLORS[s.region] || 'bg-gray-100 text-gray-600'}`}>
                      {s.region}
                    </span>
                  )}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${diffColor(s.difficulty)}`}>
                    {{ EASY: '简单', MEDIUM: '中等', HARD: '困难', EXPERT: '专家' }[s.difficulty as string] || s.difficulty}
                  </span>
                  {!s.isPreset && isAdmin && (
                    <>
                      <button onClick={(e) => openEdit(s, e)} className="text-secondary-300 hover:text-primary-500 transition-colors p-0.5"><Pencil size={13} /></button>
                      <button onClick={(e) => handleDelete(s.id, e)} className="text-secondary-300 hover:text-red-500 transition-colors p-0.5"><X size={13} /></button>
                    </>
                  )}
                  {isSelected ? <ChevronUp size={16} className="text-primary-500" /> : <ChevronDown size={16} className="text-secondary-300" />}
                </div>
              </div>
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-secondary-100 space-y-2 animate-slide-up">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {s.category && <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-600">{s.category}</span>}
                    {s.region && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${REGION_COLORS[s.region] || 'bg-gray-100 text-gray-600'}`}>{s.region}</span>}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${diffColor(s.difficulty)}`}>
                      {{ EASY: '简单', MEDIUM: '中等', HARD: '困难', EXPERT: '专家' }[s.difficulty as string] || s.difficulty}
                    </span>
                  </div>
                  <div className="p-3 bg-secondary-50 rounded-xl">
                    <p className="text-xs text-secondary-400 mb-1">背景</p>
                    <p className="text-sm text-secondary-700">{s.background}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <p className="text-xs text-blue-500 mb-1">目标</p>
                      <p className="text-xs text-blue-700">{s.objectives}</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-xl">
                      <p className="text-xs text-purple-500 mb-1">评估维度</p>
                      <p className="text-xs text-purple-700">{s.evaluationCriteria}</p>
                    </div>
                  </div>
                  {!s.isPreset && isAdmin && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={(e) => openEdit(s, e)} className="btn-primary text-xs px-3 py-1.5"><Pencil size={12} /> 编辑</button>
                      <button onClick={(e) => handleDelete(s.id, e)} className="btn-secondary text-xs px-3 py-1.5 text-red-600 border-red-200 hover:bg-red-50"><X size={12} /> 删除</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-secondary-400">
            <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">未找到匹配场景</p>
            {isAdmin && <button onClick={openCreate} className="btn-primary text-sm mt-3"><Plus size={16} /> 创建第一个场景</button>}
          </div>
        )}
      </div>

      {/* 地区覆盖提示 */}
      <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-200">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">各地区场景覆盖情况</h4>
        <div className="flex flex-wrap gap-2">
          {KNOWN_REGIONS.filter(r => r).map(region => {
            const count = scenarios.filter(s => s.region === region).length;
            const hasRole = ['中东','欧洲','北美','俄罗斯','南美','澳洲','东南亚','中国','印度'].includes(region);
            return (
              <div key={region} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${count > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                <span className={`w-2 h-2 rounded-full ${count > 0 ? 'bg-green-500' : 'bg-red-400'}`} />
                {region} {count > 0 ? `(${count}个)` : '(0个)'}
                {hasRole && count === 0 && <span className="ml-1 text-[10px]">⚠️ 有角色无场景</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
