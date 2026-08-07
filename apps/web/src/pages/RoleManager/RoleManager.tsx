import { useState, useEffect, useRef } from 'react';
import { Globe, User, Briefcase, Plus, X, Search, ChevronDown, ChevronUp, Tag, Sparkles, Wand2, Loader2, Pencil } from 'lucide-react';
import api, { quickCreateRole } from '../../api/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { showToast } from '../../components/Toast';
import { SkeletonGrid } from '../../components/Skeleton';

const KNOWN_REGIONS = ['', '中东', '欧洲', '北美', '俄罗斯', '南美', '澳洲', '东南亚', '日本', '中亚', '中国', '印度', '通用'];

const LANGUAGES = ['English', 'Spanish/English', 'Russian/English', 'Arabic/English', 'French/English', 'Chinese/English', 'English/Arabic', 'English/Hindi'];

export default function RoleManager() {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollToCard = (id: string) => {
    requestAnimationFrame(() => cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  // Generate avatar from name (same as TrainingRoom)
  const getAvatar = (name?: string) => {
    if (!name) return { gradient: 'from-blue-500 to-blue-600', initials: '?' };
    const colors = [
      'from-blue-500 to-blue-600', 'from-emerald-500 to-emerald-600', 'from-violet-500 to-violet-600',
      'from-amber-500 to-amber-600', 'from-rose-500 to-rose-600', 'from-cyan-500 to-cyan-600',
      'from-orange-500 to-orange-600', 'from-pink-500 to-pink-600', 'from-teal-500 to-teal-600',
      'from-indigo-500 to-indigo-600', 'from-lime-500 to-lime-600', 'from-fuchsia-500 to-fuchsia-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
    const idx = Math.abs(hash) % colors.length;
    const parts = name.trim().split(/\s+/);
    const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    return { gradient: colors[idx], initials };
  };
  const [roles, setRoles] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [quickDesc, setQuickDesc] = useState('');
  const [quickCreating, setQuickCreating] = useState(false);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [form, setForm] = useState({
    name: '', gender: 'MALE', customerType: '', region: '', position: '',
    annualRevenue: '', coreTags: '', languagePreference: 'English',
    communicationStyle: '', decisionStyle: '', painPoints: '',
    productFocus: '', personalityTraits: '', promptTemplate: '',
  });

  const loadRoles = () => { api.get('/roles').then(r => { setRoles(r.data); setLoading(false); }).catch(() => { setLoading(false); }); };
  useEffect(() => { loadRoles(); }, []);

  const filtered = roles.filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.region?.toLowerCase().includes(search.toLowerCase()) ||
    r.position?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', gender: 'MALE', customerType: '', region: '', position: '', annualRevenue: '', coreTags: '', languagePreference: 'English', communicationStyle: '', decisionStyle: '', painPoints: '', productFocus: '', personalityTraits: '', promptTemplate: '' });
    setShowForm(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      name: r.name || '', gender: r.gender || 'MALE', customerType: r.customerType || '',
      region: r.region || '', position: r.position || '', annualRevenue: r.annualRevenue || '',
      coreTags: r.coreTags || '', languagePreference: r.languagePreference || 'English',
      communicationStyle: r.communicationStyle || '', decisionStyle: r.decisionStyle || '',
      painPoints: r.painPoints || '', productFocus: r.productFocus || '',
      personalityTraits: r.personalityTraits || '', promptTemplate: r.promptTemplate || '',
    });
    setShowForm(true);
  };

  const handleQuickCreate = async () => {
    if (!quickDesc.trim()) {
      alert('请输入角色描述');
      return;
    }
    setQuickCreating(true);
    try {
      const res = await quickCreateRole(quickDesc.trim());
      if (res?.data) {
        setForm({
          name: res.data.name || '',
          gender: res.data.gender || 'MALE',
          customerType: res.data.customerType || '',
          region: res.data.region || '',
          position: res.data.position || '',
          annualRevenue: res.data.annualRevenue || '',
          coreTags: res.data.coreTags || '',
          languagePreference: res.data.languagePreference || 'English',
          communicationStyle: res.data.communicationStyle || '',
          decisionStyle: res.data.decisionStyle || '',
          painPoints: res.data.painPoints || '',
          productFocus: res.data.productFocus || '',
          personalityTraits: res.data.personalityTraits || '',
          promptTemplate: res.data.promptTemplate || '',
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

  const handleCreate = async () => {
    if (!form.name) {
      alert('请填写角色姓名');
      return;
    }
    try {
      if (editingId) {
        await api.put(`/roles/${editingId}`, form);
      } else {
        await api.post('/roles', { ...form, isPreset: false });
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', gender: 'MALE', customerType: '', region: '', position: '', annualRevenue: '', coreTags: '', languagePreference: 'English', communicationStyle: '', decisionStyle: '', painPoints: '', productFocus: '', personalityTraits: '', promptTemplate: '' });
      loadRoles();
    } catch (err) {
      console.error('error:', err);
      alert(editingId ? '更新角色失败' : '创建角色失败');
    }
  };

  const handleAiGenerate = async () => {
    if (!form.name) {
      alert('请至少填写姓名后再使用AI生成');
      return;
    }
    setAiGenerating(true);
    try {
      const res = await api.post('/ai/generate-role-fields', form);
      setForm(prev => ({
        ...prev,
        painPoints: res.data.painPoints || prev.painPoints,
        personalityTraits: res.data.personalityTraits || prev.personalityTraits,
        promptTemplate: res.data.promptTemplate || prev.promptTemplate,
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
      if (!confirm('确定删除此角色？')) return;
      await api.delete(`/roles/${id}`);
      setSelected(null);
      loadRoles();
      showToast('success', '角色已删除');
    } catch (err) {
      console.error('error:', err);
      showToast('error', '删除失败，请重试');
    }
  };

  if (loading) return <div className="p-8"><SkeletonGrid count={6} /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">角色管理</h2>
          <p className="text-sm text-secondary-500 mt-1">管理AI陪练客户角色</p>
        </div>
        {isAdmin && <button onClick={() => setShowForm(true)} className="btn-primary text-sm"><Plus size={16} /> 新增角色</button>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-lg border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center"><Sparkles size={16} className="text-white" /></div>
                <h3 className="text-lg font-bold">{editingId ? '编辑角色' : '新建角色'}</h3>
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
                  <p className="text-[11px] text-violet-500 mb-2">输入一段简单描述，AI自动生成完整角色，你再精细调整</p>
                  <div className="flex gap-2">
                    <input value={quickDesc} onChange={e => setQuickDesc(e.target.value)}
                      placeholder="如：中东石油公司采购经理，价格敏感、决策流程严格，关注本地化要求"
                      className="input text-sm flex-1" />
                    <button onClick={handleQuickCreate} disabled={quickCreating || !quickDesc.trim()}
                      className="btn-primary text-xs px-3 py-1.5 shrink-0 disabled:opacity-50 flex items-center gap-1.5">
                      {quickCreating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                      {quickCreating ? '生成中...' : '智能创建'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-secondary-500 mb-1 block">姓名 *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="John Smith" className="input text-sm" /></div>
                <div><label className="text-xs text-secondary-500 mb-1 block">性别</label>
                  <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="input text-sm">
                    <option value="MALE">男 ♂</option>
                    <option value="FEMALE">女 ♀</option>
                  </select>
                </div>
                <div><label className="text-xs text-secondary-500 mb-1 block">客户类型</label><input value={form.customerType} onChange={e => setForm({...form, customerType: e.target.value})} placeholder="国际油田服务公司" className="input text-sm" /></div>
                <div><label className="text-xs text-secondary-500 mb-1 block">地区</label>
                  <input list="region-list-r" value={form.region} onChange={e => setForm({...form, region: e.target.value})} placeholder="选择或输入，如：中东（沙特）" className="input text-sm" />
                  <datalist id="region-list-r">
                    {KNOWN_REGIONS.filter(r => r).map(r => <option key={r} value={r} />)}
                  </datalist>
                </div>
                <div><label className="text-xs text-secondary-500 mb-1 block">职位</label><input value={form.position} onChange={e => setForm({...form, position: e.target.value})} placeholder="采购经理" className="input text-sm" /></div>
                <div><label className="text-xs text-secondary-500 mb-1 block">年营收</label><input value={form.annualRevenue} onChange={e => setForm({...form, annualRevenue: e.target.value})} placeholder="10亿美元" className="input text-sm" /></div>
                <div><label className="text-xs text-secondary-500 mb-1 block">核心标签</label><input value={form.coreTags} onChange={e => setForm({...form, coreTags: e.target.value})} placeholder="价格敏感·快速成交" className="input text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-secondary-500 mb-1 block">语言</label><input value={form.languagePreference} onChange={e => setForm({...form, languagePreference: e.target.value})} placeholder="English / Arabic" className="input text-sm" /></div>
                <div><label className="text-xs text-secondary-500 mb-1 block">沟通风格</label><input value={form.communicationStyle} onChange={e => setForm({...form, communicationStyle: e.target.value})} placeholder="直接、任务导向" className="input text-sm" /></div>
                <div><label className="text-xs text-secondary-500 mb-1 block">决策风格</label><input value={form.decisionStyle} onChange={e => setForm({...form, decisionStyle: e.target.value})} placeholder="数据驱动" className="input text-sm" /></div>
                <div><label className="text-xs text-secondary-500 mb-1 block">产品关注</label><input value={form.productFocus} onChange={e => setForm({...form, productFocus: e.target.value})} placeholder="MWD/LWD系统" className="input text-sm" /></div>
              </div>
              {/* AI 智能生成区域 */}
              <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-4 border border-primary-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 size={16} className="text-primary-600" />
                    <span className="text-xs font-semibold text-primary-700">AI 智能生成</span>
                  </div>
                  <button onClick={handleAiGenerate} disabled={aiGenerating || !form.name}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 flex items-center gap-1.5">
                    {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    {aiGenerating ? '生成中...' : '一键生成'}
                  </button>
                </div>
                <p className="text-[11px] text-primary-500 mb-2">根据已填信息自动生成痛点、性格特质和AI提示词</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-primary-600 font-medium mb-1 block">痛点（AI生成）</label>
                    <textarea value={form.painPoints} onChange={e => setForm({...form, painPoints: e.target.value})}
                      className="input text-xs h-14" placeholder="点击「一键生成」自动填充，也可手动修改" />
                  </div>
                  <div>
                    <label className="text-[11px] text-primary-600 font-medium mb-1 block">性格特质（AI生成）</label>
                    <textarea value={form.personalityTraits} onChange={e => setForm({...form, personalityTraits: e.target.value})}
                      className="input text-xs h-14" placeholder="点击「一键生成」自动填充，也可手动修改" />
                  </div>
                  <div>
                    <label className="text-[11px] text-primary-600 font-medium mb-1 block">AI提示词（AI生成）</label>
                    <textarea value={form.promptTemplate} onChange={e => setForm({...form, promptTemplate: e.target.value})}
                      className="input text-xs h-20" placeholder="点击「一键生成」自动填充，也可手动修改" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t bg-secondary-50">
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">取消</button>
              <button onClick={handleCreate} className="btn-primary text-sm">创建角色</button>
            </div>
          </div>
        </div>
      )}

      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索角色..." className="input pl-9 text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
        {filtered.map((r) => {
          const isSelected = selected === r.id;
          return (
        <div key={r.id} ref={el => { if (el) cardRefs.current.set(r.id, el); }}
          className={`bg-white rounded-2xl border border-secondary-200 p-4 cursor-pointer relative group ${isSelected ? 'ring-2 ring-primary-500 shadow-md' : 'hover:shadow-sm'}`}
          onClick={() => { const was = isSelected; setSelected(was ? null : r.id); if (!was) scrollToCard(r.id); }}
        >
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getAvatar(r.name).gradient} flex items-center justify-center shrink-0 shadow-sm`}>
              <span className="text-white font-bold text-xs">{getAvatar(r.name).initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-secondary-900 text-sm truncate">{r.name} <span className="text-xs text-secondary-400">{r.gender === 'FEMALE' ? '♀' : '♂'}</span></h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 编辑/删除 — 始终可见但半透明 */}
                  {!r.isPreset && isAdmin && (
                    <div className="flex gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded-lg hover:bg-primary-50" title="编辑">
                        <Pencil size={12} className="text-secondary-400 hover:text-primary-500" />
                      </button>
                      <button onClick={e => handleDelete(r.id, e)} className="p-1 rounded-lg hover:bg-red-50" title="删除">
                        <X size={12} className="text-secondary-400 hover:text-red-500" />
                      </button>
                    </div>
                  )}
                  {isSelected ? <ChevronUp size={16} className="text-primary-500 shrink-0" /> : <ChevronDown size={16} className="text-secondary-300 shrink-0" />}
                </div>
              </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-secondary-500">
                    <Briefcase size={12} /><span className="truncate">{r.position}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-secondary-500">
                    <Globe size={12} /><span>{r.region}</span>
                  </div>
                  {r.coreTags && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Tag size={11} className="text-secondary-400" />
                      <span className="text-[11px] text-secondary-400 truncate">{r.coreTags}</span>
                    </div>
                  )}
                </div>
                {isSelected ? <ChevronUp size={16} className="text-primary-500 mt-1 shrink-0" /> : <ChevronDown size={16} className="text-secondary-300 mt-1 shrink-0" />}
              </div>
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-secondary-100 animate-slide-up">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div><span className="text-xs text-secondary-400">客户类型</span><p className="font-medium text-secondary-700 text-xs">{r.customerType}</p></div>
                    <div><span className="text-xs text-secondary-400">性别</span><p className="font-medium text-secondary-700 text-xs">{r.gender === 'FEMALE' ? '女 ♀' : '男 ♂'}</p></div>
                    <div><span className="text-xs text-secondary-400">年营收</span><p className="font-medium text-secondary-700 text-xs">{r.annualRevenue}</p></div>
                    <div className="col-span-2"><span className="text-xs text-secondary-400">语言</span><p className="font-medium text-secondary-700 text-xs">{r.languagePreference}</p></div>
                    <div className="col-span-2"><span className="text-xs text-secondary-400">沟通风格</span><p className="text-secondary-600 text-xs">{r.communicationStyle}</p></div>
                    <div className="col-span-2"><span className="text-xs text-secondary-400">决策风格</span><p className="text-secondary-600 text-xs">{r.decisionStyle}</p></div>
                    <div className="col-span-2"><span className="text-xs text-secondary-400">产品关注</span><p className="text-secondary-600 text-xs">{r.productFocus}</p></div>
                    <div className="col-span-2"><span className="text-xs text-secondary-400">痛点</span><p className="text-secondary-600 text-xs">{r.painPoints}</p></div>
                    <div className="col-span-2"><span className="text-xs text-secondary-400">性格</span><p className="text-secondary-600 text-xs">{r.personalityTraits}</p></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-secondary-400">
            <User size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">未找到匹配角色</p>
          </div>
        )}
      </div>
    </div>
  );
}
