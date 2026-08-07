import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Bug, Lightbulb, Sparkles, HelpCircle, Loader2 } from 'lucide-react';
import api from '../api/apiClient';
import { useAuthStore } from '../stores/authStore';

const FEEDBACK_TYPES = [
  { value: 'BUG', label: 'Bug 报告', icon: Bug, color: 'text-red-500' },
  { value: 'FEATURE', label: '功能建议', icon: Lightbulb, color: 'text-amber-500' },
  { value: 'IMPROVEMENT', label: '改进意见', icon: Sparkles, color: 'text-blue-500' },
  { value: 'OTHER', label: '其他', icon: HelpCircle, color: 'text-secondary-500' },
];

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('BUG');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuthStore();
  const location = useLocation();

  // Auto-focus textarea when dialog opens — must be BEFORE early return to keep hooks count consistent
  useEffect(() => {
    if (open) setTimeout(() => contentRef.current?.focus(), 300);
  }, [open]);

  // 对话室页面不需要反馈按钮（避免遮挡发送按钮）
  if (location.pathname === '/training') return null;

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/feedback', { type, content: content.trim(), contact: contact.trim() || user?.email || '' });
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setContent(''); setContact(''); setType('BUG'); }, 1500);
    } catch {
      alert('提交失败，请重试');
    }
    setSubmitting(false);
  };

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group"
        title="反馈意见"
      >
        <MessageCircle size={20} className="text-white" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[8px] text-white font-bold flex items-center justify-center">!</span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !submitting && setOpen(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl border animate-slide-up max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center"><MessageCircle size={14} className="text-white" /></div>
                <h3 className="font-bold text-sm">提交反馈</h3>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-secondary-100"><X size={16} /></button>
            </div>

            {done ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><Send size={20} className="text-green-600" /></div>
                <p className="font-semibold text-secondary-900">感谢您的反馈！</p>
                <p className="text-xs text-secondary-500 mt-1">管理员会尽快查看并处理</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Type selector */}
                <div>
                  <label className="text-xs text-secondary-500 mb-1.5 block">反馈类型</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FEEDBACK_TYPES.map(t => (
                      <button key={t.value} onClick={() => setType(t.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${type === t.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-secondary-200 text-secondary-600 hover:border-secondary-300'}`}
                      >
                        <t.icon size={14} className={t.color} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div>
                  <label className="text-xs text-secondary-500 mb-1 block">详细描述</label>
                  <textarea ref={contentRef} value={content} onChange={e => setContent(e.target.value)}
                    placeholder={
                      type === 'BUG' ? '请描述遇到的问题、出现步骤和期望表现...' :
                      type === 'FEATURE' ? '请描述你希望添加的功能...' :
                      type === 'IMPROVEMENT' ? '请描述你的改进建议...' :
                      '请描述你的想法...'
                    }
                    className="input text-sm h-28 resize-none" maxLength={2000} />
                  <p className="text-[11px] text-secondary-400 mt-1 text-right">{content.length}/2000</p>
                </div>

                {/* Contact */}
                <div>
                  <label className="text-xs text-secondary-500 mb-1 block">联系方式（选填）</label>
                  <input value={contact} onChange={e => setContact(e.target.value)}
                    placeholder={user?.email || '微信 / 邮箱 / 电话'}
                    className="input text-sm" />
                </div>

                {/* Submit */}
                <button onClick={handleSubmit} disabled={submitting || !content.trim()}
                  className="btn-primary w-full text-sm py-2.5 disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {submitting ? '提交中...' : '提交反馈'}
                </button>
                <p className="text-[10px] text-secondary-400 text-center">提交后管理员会在每日报告中审阅，决定是否优化</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
