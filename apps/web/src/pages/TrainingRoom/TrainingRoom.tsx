import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, MessageSquare, Flag, RotateCcw, Paperclip, Check, CheckCheck, Loader2, FileText, X, Reply, PauseCircle, Play, ChevronDown, ChevronUp, Award, TrendingUp, ThumbsUp, ThumbsDown, Zap, AlertTriangle, BarChart3 } from 'lucide-react';
import { getRoles, getScenarios, createSession, sendMessage, evaluateSession, getMessages, updateSessionStatus, getReport } from '../../api/apiClient';

export default function TrainingRoom() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; size: number }[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [readStatus, setReadStatus] = useState<Record<string, string>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState(0);
  const [step, setStep] = useState(1); // 1=选择角色, 2=选择场景
  const [quoteTarget, setQuoteTarget] = useState<{ id: string; content: string; role: string; sender: string } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [completedReportId, setCompletedReportId] = useState<string | null>(null);
  const [preliminaryReport, setPreliminaryReport] = useState<any>(null);
  const [confirmScenario, setConfirmScenario] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(window.innerWidth >= 768);
  const [kbOffset, setKbOffset] = useState(0); // keyboard height offset for mobile
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const briefingCache = useRef<Record<string, { need: string; task: string }>>({});

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatting]);

  // Fetch report data when evaluation completes
  useEffect(() => {
    if (completedReportId) {
      getReport(completedReportId).then(res => setPreliminaryReport(res.data)).catch(() => {});
    } else {
      setPreliminaryReport(null);
    }
  }, [completedReportId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTraining) {
        // Esc: close quote target or clear file selection
        if (quoteTarget) { setQuoteTarget(null); e.preventDefault(); }
        else if (selectedFiles.length > 0) { setSelectedFiles([]); setPendingFiles([]); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isTraining, quoteTarget, selectedFiles.length]);

  // Handle mobile keyboard: scroll to bottom when input is focused
  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
      // On mobile, also scroll the viewport to ensure input is visible
      if (window.innerWidth < 768 && textareaRef.current) {
        setTimeout(() => {
          textareaRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 100);
      }
    }, 300);
  };

  // Listen for visualViewport resize (keyboard open/close on mobile)
  useEffect(() => {
    const handleResize = () => {
      if (document.activeElement?.tagName === 'TEXTAREA') {
        scrollToBottom();
      }
      // Track keyboard offset: on mobile, visualViewport height shrinks when keyboard opens
      if (window.visualViewport) {
        const vv = window.visualViewport;
        const diff = window.innerHeight - vv.height;
        setKbOffset(diff > 50 ? diff : 0);
      }
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }
  }, []);

  // Safe getters for role/scenario to prevent crashes from stale localStorage
  const safeRole = (id?: string) => {
    if (!id) return undefined;
    try { return roles.find(r => r.id === id); } catch { return undefined; }
  };
  const safeScenario = (id?: string) => {
    if (!id) return undefined;
    try { return scenarios.find(s => s.id === id); } catch { return undefined; }
  };
  const safeRoleName = (id?: string) => {
    try { return safeRole(id)?.name || '未知角色'; } catch { return '未知角色'; }
  };

  // Extract key region keyword from role's region string (shared function)
  const getRoleMatchRegion = (region: string) => {
    if (/中东|沙特|阿联酋|伊拉克/.test(region)) return '中东';
    if (/欧洲|挪威|英国|法国|巴黎/.test(region)) return '欧洲';
    if (/俄罗斯/.test(region)) return '俄罗斯';
    if (/北美|美国|德州|墨西哥/.test(region)) return '北美';
    if (/中国|北京/.test(region)) return '中国';
    if (/印度/.test(region)) return '印度';
    if (/南美|巴西|阿根廷|哥伦比亚|拉美/.test(region)) return '南美';
    if (/澳洲/.test(region)) return '澳洲';
    if (/东南亚|马来西亚|印尼/.test(region)) return '东南亚';
    if (/日本/.test(region)) return '日本';
    if (/中亚|哈萨克/.test(region)) return '中亚';
    return '通用';
  };
  
  const getMatchedScenarios = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role || !role.region) return scenarios;
    
    const matchRegion = getRoleMatchRegion(role.region);
    // Filter: only show scenarios matching role's region or '通用' scenarios
    const matched = scenarios.filter(s => {
      const sRegion = s.region || '通用';
      return sRegion === matchRegion || sRegion === '通用';
    });
    // Sort so exact match comes first, then 通用
    return matched.sort((a, b) => {
      const aRegion = a.region || '通用';
      const bRegion = b.region || '通用';
      if (aRegion === matchRegion && bRegion !== matchRegion) return -1;
      if (aRegion !== matchRegion && bRegion === matchRegion) return 1;
      return 0;
    });
  };

  // Render a scenario card (used in recommended and other sections)
  const renderScenarioCard = (s: any, roleMatchRegion: string, roleRegion: string, regionColors: Record<string, string>, isMatched: boolean, selectedId: string, onSelect: (id: string) => void, roleName?: string) => {
    const diffLabel = { EASY: '简单', MEDIUM: '中等', HARD: '困难', EXPERT: '专家' }[s.difficulty as string] || s.difficulty;
    const diffColor = s.difficulty === 'EASY' ? 'bg-green-100 text-green-700' : s.difficulty === 'MEDIUM' ? 'bg-blue-100 text-blue-700' : s.difficulty === 'HARD' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
    const isSelected = selectedId === s.id;
    const regionColor = regionColors[s.region || '通用'] || 'bg-gray-100 text-gray-600';
    const description = (s.description || '').replace(/该客户/g, roleName || '该客户');

    return (
      <div key={s.id}
        className={`rounded-xl border-2 p-3 cursor-pointer transition-all duration-200 ${
          isSelected
            ? 'border-primary-500 bg-primary-50/50 shadow-sm ring-1 ring-primary-200'
            : isMatched
              ? 'border-amber-200 bg-amber-50/30 hover:border-amber-300 hover:shadow-sm'
              : 'border-secondary-200 hover:border-secondary-300 hover:shadow-sm'
        }`}
        onClick={() => onSelect(s.id)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-sm font-medium text-secondary-900 truncate">{s.title.split(' - ')[0]}</span>
              {isMatched && <span className="text-[12px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">★ 推荐</span>}
            </div>
            <p className="text-[11px] text-secondary-500 leading-relaxed line-clamp-2">{description}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${diffColor}`}>{diffLabel}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${regionColor}`}>{s.region || '通用'}</span>
              <span className="text-[10px] text-secondary-400 bg-secondary-100 px-1.5 py-0.5 rounded-full">{s.category}</span>
            </div>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
            isSelected ? 'border-primary-500 bg-primary-500' : 'border-secondary-300'
          }`}>
            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    getRoles().then(r => { if (r?.data) setRoles(r.data); }).catch(() => {});
    getScenarios().then(r => { if (r?.data) setScenarios(r.data); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Restore saved session on mount (refresh / continue from Dashboard)
  useEffect(() => {
    try {
      const savedId = localStorage.getItem('training_session_id');
      if (savedId && !loading && roles.length > 0) {
        const savedRoleId = localStorage.getItem('training_role_id');
        const savedScenarioId = localStorage.getItem('training_scenario_id');
        // Validate: role must still exist in loaded data
        const roleExists = savedRoleId && roles.some(r => r.id === savedRoleId);
        if (!roleExists) {
          // Stale data - clear and show selection page
          localStorage.removeItem('training_session_id');
          localStorage.removeItem('training_role_id');
          localStorage.removeItem('training_scenario_id');
          return;
        }
        if (savedRoleId) setSelectedRoleId(savedRoleId);
        if (savedScenarioId) setSelectedScenarioId(savedScenarioId);
        setSessionId(savedId);
        setIsTraining(true);
      }
    } catch { /* localStorage might be blocked */ }
  }, [loading, roles]);

  // Handle mobile back button - go to step 1 instead of leaving page
  useEffect(() => {
    if (step === 2) {
      window.history.pushState({ step: 2 }, '');
      const handlePop = () => {
        setStep(1);
        window.history.pushState({ step: 1 }, '');
      };
      window.addEventListener('popstate', handlePop);
      return () => window.removeEventListener('popstate', handlePop);
    }
  }, [step]);

  useEffect(() => {
    if (sessionId) {
      getMessages(sessionId).then(r => {
        if (r.data && r.data.length > 0) {
          setMessages(r.data);
          // Mark all existing user messages as 'read'
          const statusMap: Record<string, string> = {};
          r.data.forEach((m: any) => {
            if (m.role === 'USER') statusMap[m.id] = 'read';
          });
          setReadStatus(prev => ({ ...prev, ...statusMap }));
        }
      }).catch(() => {});
    }
  }, [sessionId]);

  const handleStart = async (presetScenarioId?: string) => {
    if (!selectedRoleId) return;
    let effectiveScenarioId = presetScenarioId || selectedScenarioId;
    if (!safeRole(selectedRoleId)) {
      setRenderError('所选角色不存在，请重新选择');
      return;
    }
    try {
      const res = await createSession({ roleId: selectedRoleId, scenarioId: effectiveScenarioId || undefined });
      if (!res?.data?.id) {
        setRenderError('创建会话失败，请重试');
        return;
      }
      localStorage.setItem('training_session_id', res.data.id);
      localStorage.setItem('training_role_id', selectedRoleId);
      // Save scenario ID from response (handles "随机场景" where backend assigns one)
      effectiveScenarioId = res.data.scenarioId || selectedScenarioId;
      if (effectiveScenarioId) {
        setSelectedScenarioId(effectiveScenarioId);
        localStorage.setItem('training_scenario_id', effectiveScenarioId);
      }
      setSessionId(res.data.id);
      setIsTraining(true);
      // Load messages from DB (includes system message created by backend)
      getMessages(res.data.id).then(r => {
        if (r.data && r.data.length > 0) {
          setMessages(r.data);
          const statusMap: Record<string, string> = {};
          r.data.forEach((m: any) => { if (m.role === 'USER') statusMap[m.id] = 'read'; });
          setReadStatus(prev => ({ ...prev, ...statusMap }));
        }
      }).catch(() => {});
    } catch (e) { console.error(e); }
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || !sessionId) return;
    // Block Chinese characters - sales must use English
    if (/[\u4e00-\u9fff]/.test(input)) {
      alert('⚠️ 请使用英文进行沟通（Please use English only）');
      return;
    }
    const userText = input;
    setInput('');
    // On mobile, scroll input into view after clearing
    if (window.innerWidth < 768) {
      setTimeout(() => textareaRef.current?.scrollIntoView({ block: 'nearest' }), 50);
    }
    // Build message with quote if active
    const text = quoteTarget
      ? `「引用 ${quoteTarget.sender}」${quoteTarget.content.slice(0, 60)}${quoteTarget.content.length > 60 ? '...' : ''}\n——\n${userText}`
      : userText;
    setQuoteTarget(null);
    setIsChatting(true);

    // If there are pending files, upload them all first
    if (pendingFiles.length > 0) {
      const files = [...pendingFiles];
      setUploading(true);

      // Show message immediately with pending status
      const msgId = Date.now().toString();
      const fileListText = files.map(f =>
        `[上传文件: ${f.name}] ${f.type?.startsWith('image/') ? '[图片]' : '[文档]'}`
      ).join('\n');
      const pendingText = `${fileListText}${text ? `\n${text}` : ''}`;
      setMessages(prev => [...prev, { id: msgId, sessionId, role: 'USER', content: `(上传中...)\n${pendingText}` }]);
      setReadStatus(prev => ({ ...prev, [msgId]: 'sent' }));

      try {
        // Upload files one by one
        let token = '';
        try { const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}'); token = stored?.state?.token || ''; } catch {}
        const uploadResults: { name: string; isImage: boolean }[] = [];
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(`${file.name} 上传失败: ${errData.error || res.statusText}`);
          }
          const data = await res.json();
          uploadResults.push({ name: file.name, isImage: data.isImage });
        }

        // All uploaded successfully, build final message
        const finalText = uploadResults.map(r =>
          `[上传文件: ${r.name}] ${r.isImage ? '[图片]' : '[文档]'}`
        ).join('\n') + (text ? `\n${text}` : '');
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: finalText } : m));

        try {
          const r = await sendMessage(sessionId, finalText);
          setReadStatus(prev => ({ ...prev, [msgId]: 'read' }));
          if (r.data?.response) {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sessionId, role: 'ASSISTANT', content: r.data.response }]);
          }
        } catch (err) { console.error(err); }
      } catch (err: any) {
        console.error('Upload failed:', err);
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: m.content.replace('(上传中...)', '(上传失败)') } : m));
      }
      setUploading(false);
      setPendingFiles([]);
      setSelectedFiles([]);
    } else {
      // No file, just send text
      const msgId = Date.now().toString();
      setMessages(prev => [...prev, { id: msgId, sessionId, role: 'USER', content: text }]);
      setReadStatus(prev => ({ ...prev, [msgId]: 'sent' }));
      try {
        const res = await sendMessage(sessionId, text);
        setReadStatus(prev => ({ ...prev, [msgId]: 'read' }));
        if (res.data?.response) {
          setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sessionId, role: 'ASSISTANT', content: res.data.response }]);
        }
        // Check if AI ended the conversation - show countdown then navigate
        if (res.data?.ended) {
          setIsEvaluating(true);
          setEvalProgress(100);
          // 3-second countdown before navigating to report
          let countdown = 3;
          const countdownTimer = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
              clearInterval(countdownTimer);
              const reportId = res.data.evaluation?.reportId;
              if (reportId) navigate(`/reports/${reportId}`);
            }
          }, 1000);
        }
      } catch (e) { console.error(e); }
    }
    setIsChatting(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setPendingFiles(prev => [...prev, ...newFiles]);
    setSelectedFiles(prev => [...prev, ...newFiles.map(f => ({ name: f.name, size: f.size }))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuote = (msg: any) => {
    const sender = msg.role === 'USER' ? '我' : '客户';
    setQuoteTarget({ id: msg.id, content: msg.content, role: msg.role, sender });
  };

  const handleCancelQuote = () => setQuoteTarget(null);

  const togglePause = async () => {
    if (!isPaused && sessionId) {
      try { await updateSessionStatus(sessionId, 'PAUSED'); } catch {}
    } else if (sessionId) {
      try { await updateSessionStatus(sessionId, 'ACTIVE'); } catch {}
    }
    setIsPaused(p => !p);
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    setIsEvaluating(true);
    setEvalProgress(0);
    const timer = setInterval(() => setEvalProgress(p => Math.min(p + 25, 85)), 600);
    try {
      const evalRes = await evaluateSession(sessionId);
      clearInterval(timer);
      setEvalProgress(100);
      const reportId = evalRes.data.reportId;
      // Wait for animation to reach 100%
      await new Promise(r => setTimeout(r, 800));
      setIsEvaluating(false);
      if (reportId) {
        setCompletedReportId(reportId);
      } else {
        navigate('/reports');
      }
    } catch (e) {
      clearInterval(timer);
      console.error('Evaluation failed:', e);
      setIsEvaluating(false);
      localStorage.removeItem('training_session_id');
      localStorage.removeItem('training_role_id');
      localStorage.removeItem('training_scenario_id');
      setSessionId(null);
      setIsTraining(false);
      setMessages([]);
      await new Promise(r => setTimeout(r, 200));
      navigate('/reports');
    }
  };

  const handleGoToFullReport = (id: string) => {
    navigate(`/reports/${id}`);
  };

  const handleCloseCompleted = () => {
    setCompletedReportId(null);
    setStep(1);
    setIsTraining(false);
    setSessionId(null);
    setMessages([]);
    localStorage.removeItem('training_session_id');
    localStorage.removeItem('training_role_id');
    localStorage.removeItem('training_scenario_id');
  };

  const handleReset = async () => {
    if (sessionId) {
      try { await updateSessionStatus(sessionId, 'COMPLETED'); } catch {}
    }
    localStorage.removeItem('training_session_id');
    localStorage.removeItem('training_role_id');
    localStorage.removeItem('training_scenario_id');
    setStep(1);
    setSessionId(null);
    setIsTraining(false);
    setMessages([]);
    setInput('');
    setReadStatus({});
    setPendingFiles([]);
    setSelectedFiles([]);
    setQuoteTarget(null);
    setIsPaused(false);
    setRenderError(null);
  };

  const renderReadStatus = (msgId: string) => {
    const status = readStatus[msgId];
    if (!status) return null;
    if (status === 'read') return <CheckCheck size={14} className="text-blue-600 ml-1" />;
    if (status === 'sent') return <Check size={14} className="text-blue-400 ml-1" />;
    return <Check size={14} className="text-blue-400 ml-1" />;
  };

  // Format AI response with special tags
  const formatMessage = (text: string) => {
    // Replace special tags with styled badges
    const tags: { pattern: RegExp; render: (match: string, ...args: string[]) => JSX.Element }[] = [
      {
        pattern: /\[时间推进: (.*?)\]/g,
        render: (_m, desc) => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 my-1 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            ⏱ {desc}
          </span>
        ),
      },
      {
        pattern: /\[虚拟文件: (.*?)\]/g,
        render: (_m, desc) => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 my-1 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            📄 {desc}
          </span>
        ),
      },
      {
        pattern: /\[引入角色: (.*?)\]/g,
        render: (_m, desc) => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 my-1 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
            👤 引入: {desc}
          </span>
        ),
      },
      {
        pattern: /「引用 (.*?)」/g,
        render: (_m, name) => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 my-1 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
            <Reply size={10} /> 引用 {name}
          </span>
        ),
      },
    ];

    let result: (string | JSX.Element)[] = [text];
    for (const { pattern, render } of tags) {
      const newResult: (string | JSX.Element)[] = [];
      for (const part of result) {
        if (typeof part !== 'string') { newResult.push(part); continue; }
        const fragments: (string | JSX.Element)[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        const re = new RegExp(pattern.source, 'g');
        while ((match = re.exec(part)) !== null) {
          if (match.index > lastIndex) fragments.push(part.slice(lastIndex, match.index));
          fragments.push(render(match[0], match[1]));
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < part.length) fragments.push(part.slice(lastIndex));
        newResult.push(...fragments);
      }
      result = newResult;
    }
    return result;
  };

  if (renderError) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 font-bold mb-2">系统进入错误</div>
        <p className="text-sm text-secondary-500 mb-4">{renderError}</p>
        <button onClick={() => { setRenderError(null); handleReset(); }} className="btn-primary text-sm">
          重新开始
        </button>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-secondary-500"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />加载中...</div>;

  // Generate avatar from name
  const getAvatar = (name?: string) => {
    if (!name) return { gradient: 'from-blue-500 to-blue-600', initials: '?' };
    const colors = [
      'from-blue-500 to-blue-600', 'from-emerald-500 to-emerald-600', 'from-violet-500 to-violet-600',
      'from-amber-500 to-amber-600', 'from-rose-500 to-rose-600', 'from-cyan-500 to-cyan-600',
      'from-orange-500 to-orange-600', 'from-pink-500 to-pink-600', 'from-teal-500 to-teal-600',
      'from-indigo-500 to-indigo-600', 'from-lime-500 to-lime-600', 'from-fuchsia-500 to-fuchsia-600',
      'from-sky-500 to-sky-600', 'from-purple-500 to-purple-600', 'from-red-500 to-red-600',
    ];
    const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return { gradient: colors[idx], initials };
  };

  // Render helpers for training view — regular functions, NOT hooks, to avoid hooks count mismatch
  const renderAmberBanner = () => {
    try {
      const role = safeRole(selectedRoleId);
      const scenario = safeScenario(selectedScenarioId);
      if (!role) return null;
      const roleName = role.name || '该客户';
      return (
        <div className="bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-2 shrink-0 my-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs text-amber-800 font-semibold truncate">{role.name || '未知角色'}</span>
              <span className="text-[11px] text-amber-600 hidden sm:inline">· {role.position || '未知职位'}</span>
              <span className="text-[11px] text-amber-500 hidden md:inline">· {role.region || '未知地区'}</span>
            </div>
            {scenario && (
              <span className="text-[11px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full shrink-0 truncate max-w-[200px]">
                {scenario.title || '未知场景'}
              </span>
            )}
          </div>
          {scenario && scenario.description && (
            <p className="text-[11px] text-amber-700 leading-relaxed mt-1">{(scenario.description||'').replace(/该客户/g, roleName)}</p>
          )}
        </div>
      );
    } catch { return null; }
  };
  const renderBriefingCard = () => {
    try {
      const scenario = safeScenario(selectedScenarioId);
      const role = safeRole(selectedRoleId);
      if (!scenario || !role) return null;
      const roleName = role.name || '该客户';
      const briefKey = `${selectedScenarioId || 'default'}_${selectedRoleId || 'default'}`;
      if (!briefingCache.current[briefKey]) {
        briefingCache.current[briefKey] = getBriefingContent(scenario, role);
      }
      const briefing = briefingCache.current[briefKey];
      return (
        <div className="shrink-0 mb-2 p-3 bg-blue-50/70 border border-blue-200 rounded-xl animate-fade-in">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] font-semibold text-blue-700">项目简报</span>
            <span className="text-[9px] text-blue-400">· {scenario.category || '对话指引'}</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-blue-800 leading-relaxed">
            <p><span className="font-medium">背景：</span>{((scenario.background || scenario.description)||'').replace(/该客户/g, roleName) || '暂无背景信息'}</p>
            <p><span className="font-medium">对方诉求：</span>{briefing.need}</p>
            <p><span className="font-medium">你的任务：</span>{briefing.task}</p>
          </div>
        </div>
      );
    } catch { return null; }
  };

  if (!isTraining) {
    return (
      <div className="animate-fade-in overflow-y-auto h-full">
        {/* Step indicator - clickable buttons */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ${step === 1 ? 'bg-primary-50 text-primary-600 ring-1 ring-primary-200' : 'text-secondary-400 hover:text-secondary-600 hover:bg-secondary-50'}`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-primary-600 text-white' : 'bg-secondary-200 text-secondary-400'}`}>1</div>
            <span className="text-xs font-medium">选择角色</span>
          </button>
          <div className="w-6 h-px bg-secondary-200" />
          <button
            onClick={() => setStep(2)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ${step === 2 ? 'bg-primary-50 text-primary-600 ring-1 ring-primary-200' : 'text-secondary-400 hover:text-secondary-600 hover:bg-secondary-50'}`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-primary-600 text-white' : 'bg-secondary-200 text-secondary-400'}`}>2</div>
            <span className="text-xs font-medium">选择场景</span>
          </button>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-secondary-900">选择陪练角色和场景</h2>
          <p className="text-sm text-secondary-500 mt-1">所有角色均为模拟训练资料，不对应真实客户</p>
        </div>

        {/* Step 1 - Role Selection */}
        <div className={`${step === 1 ? 'block' : 'hidden'}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
            {roles.map(r => {
              const avatar = getAvatar(r.name);
              const isSelected = selectedRoleId === r.id;
              return (
                <div key={r.id}
                  className={`bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 text-center
                    ${isSelected ? 'border-primary-500 shadow-md shadow-primary-100' : 'border-secondary-200 hover:border-secondary-300 hover:shadow-sm'}`}
                  onClick={() => { setSelectedRoleId(r.id); setStep(2); }}
                >
                  <div className={`w-12 h-12 mx-auto mb-2.5 rounded-xl bg-gradient-to-br ${avatar.gradient} flex items-center justify-center shadow-sm`}>
                    <span className="text-white font-bold text-sm">{avatar.initials}</span>
                  </div>
                  <h3 className="font-semibold text-secondary-900 text-xs truncate">{r.name}</h3>
                  <p className="text-[10px] text-secondary-500 truncate mt-0.5">{r.position}</p>
                  <p className="text-[10px] text-secondary-400 truncate">{r.region}</p>
                  <span className="inline-flex mt-1 text-[9px] rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">模拟客户</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2 - Scenario Selection */}
        <div className={`${step === 2 ? 'block' : 'hidden'}`}>
          {/* Back button */}
          {step === 2 && (
            <button onClick={() => setStep(1)} className="btn-secondary text-xs mb-3">
              ← 返回选择角色
            </button>
          )}

          <div className="grid grid-cols-1 gap-4">
            {/* Show selected role detail */}
            {selectedRoleId && step === 2 && (() => {
              const role = roles.find(r => r.id === selectedRoleId);
              if (!role) return null;
              const avatar = getAvatar(role.name);
              return (
                <div className="bg-white rounded-2xl border border-secondary-200 p-5 animate-slide-up">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${avatar.gradient} flex items-center justify-center shadow-sm shrink-0`}>
                      <span className="text-white font-bold text-lg">{avatar.initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-secondary-900 text-lg">{role.name}</h3>
                      <p className="text-sm text-secondary-500">{role.position} · {role.region}</p>
                      <p className="mt-1 text-xs font-medium text-amber-700">模拟客户角色，不关联真实客户档案</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {role.coreTags?.split('·').map((t: string, i: number) => (
                          <span key={i} className="text-[11px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">{t.trim()}</span>
                        ))}
                      </div>
                      <p className="text-sm text-secondary-600 mt-3 leading-relaxed">{role.painPoints}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="bg-white rounded-2xl border border-secondary-200 p-5">
              <label className="text-xs font-semibold text-secondary-600 mb-3 block">选择场景</label>
              
              {/* Scenario cards - full width list */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {/* Random scenario option */}
                <div
                  className={`rounded-xl border-2 p-3 cursor-pointer transition-all duration-200 ${
                    !selectedScenarioId 
                      ? 'border-primary-500 bg-primary-50/50 shadow-sm' 
                      : 'border-secondary-200 hover:border-secondary-300 hover:shadow-sm'
                  }`}
                  onClick={() => setConfirmScenario('')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      !selectedScenarioId ? 'bg-primary-600 text-white' : 'bg-secondary-200 text-secondary-500'
                    }`}>🎲</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!selectedScenarioId ? 'text-primary-700' : 'text-secondary-700'}`}>随机场景</p>
                      <p className="text-[11px] text-secondary-400">系统自动匹配角色地区</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      !selectedScenarioId ? 'bg-primary-100 text-primary-600' : 'bg-secondary-100 text-secondary-500'
                    }`}>推荐</span>
                  </div>
                </div>

                {(() => {
                  const matched = getMatchedScenarios(selectedRoleId);
                  const role = roles.find(r => r.id === selectedRoleId);
                  const roleRegion = role?.region || '';
                  const roleMatchRegion = roleRegion ? getRoleMatchRegion(roleRegion) : '';
                  const regionColors: Record<string, string> = {
                    '中东': 'bg-orange-100 text-orange-700', '欧洲': 'bg-indigo-100 text-indigo-700',
                    '北美': 'bg-blue-100 text-blue-700', '俄罗斯': 'bg-purple-100 text-purple-700',
                    '中国': 'bg-red-100 text-red-700', '印度': 'bg-amber-100 text-amber-700',
                    '南美': 'bg-emerald-100 text-emerald-700', '澳洲': 'bg-cyan-100 text-cyan-700',
                    '东南亚': 'bg-teal-100 text-teal-700', '日本': 'bg-pink-100 text-pink-700',
                    '中亚': 'bg-yellow-100 text-yellow-700', '通用': 'bg-gray-100 text-gray-600',
                  };
                  
                  const recommendedScenarios = matched.filter(s => roleMatchRegion && (s.region || '通用') === roleMatchRegion);
                  const otherScenarios = matched.filter(s => !(roleMatchRegion && (s.region || '通用') === roleMatchRegion));
                  
                  return (
                    <>
                      {/* Recommended scenarios section */}
                      {recommendedScenarios.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 mt-3 mb-2">
                            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">★ 推荐场景</span>
                            <span className="text-[11px] text-secondary-400">适合{role?.name}的训练场景</span>
                          </div>
                          {recommendedScenarios.map(s => renderScenarioCard(s, roleMatchRegion, roleRegion, regionColors, true, selectedScenarioId, setConfirmScenario, role?.name))}
                        </>
                      )}
                      
                      {/* Other scenarios section */}
                      {otherScenarios.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 mt-4 mb-2">
                            <span className="text-xs font-semibold text-secondary-500">其他场景</span>
                            <div className="flex-1 h-px bg-secondary-200"></div>
                          </div>
                          {otherScenarios.map(s => renderScenarioCard(s, roleMatchRegion, roleRegion, regionColors, false, selectedScenarioId, setConfirmScenario, role?.name))}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
              <p className="text-center text-[11px] text-secondary-400 mt-3">点击场景后确认开始陪练</p>
            </div>
          </div>
        </div>

        {/* Scenario confirmation modal */}
        {confirmScenario !== null && (() => {
          const scenario = confirmScenario === '' 
            ? { title: '随机场景', description: '系统自动匹配角色地区的相关场景' }
            : scenarios.find(s => s.id === confirmScenario);
          if (!scenario) return null;
          const confirmRole = safeRole(selectedRoleId);
          const confirmRoleName = confirmRole?.name || '该客户';
          return (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmScenario(null)}>
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-5">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-200">
                    <MessageSquare size={24} className="text-white" />
                  </div>
                  <h3 className="font-bold text-lg text-secondary-900">确认开始陪练</h3>
                  <p className="text-sm text-secondary-500 mt-1">你将扮演的客户和场景：</p>
                  {/* Role info card */}
                  <div className="mt-3 bg-amber-50 rounded-xl p-3 border border-amber-100 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-amber-800">{confirmRole?.name || ''}</span>
                      <span className="text-[10px] text-amber-600">· {confirmRole?.position || ''}</span>
                      <span className="text-[10px] text-amber-500">· {confirmRole?.region || ''}</span>
                    </div>
                    <p className="text-[11px] text-amber-700 mt-1">你需要在对话中了解这个客户的具体需求，展示你的产品和专业能力。</p>
                  </div>
                  {/* Scenario info card */}
                  <div className="mt-2 bg-blue-50 rounded-xl p-3 border border-blue-100 text-left">
                    <p className="font-semibold text-blue-800 text-sm">{scenario.title}</p>
                    <p className="text-xs text-blue-600 mt-1 line-clamp-2">{(scenario as any).description ? (scenario as any).description.replace(/该客户/g, confirmRoleName) : ''}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmScenario(null)}
                    className="btn-secondary flex-1 text-sm">
                    我再考虑一下
                  </button>
                  <button onClick={() => {
                    const sid = confirmScenario === '' ? '' : confirmScenario;
                    setSelectedScenarioId(sid);
                    setConfirmScenario(null);
                    handleStart(sid);
                  }} className="btn-primary flex-1 text-sm">
                    开始陪练
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // Training mode
  if (renderError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="text-red-500 font-bold text-lg mb-2">⛔ 系统进入错误</div>
          <p className="text-sm text-secondary-500 mb-1">陪练室渲染异常，请重新开始</p>
          <p className="text-xs text-secondary-400 mb-4">{renderError}</p>
          <button onClick={() => { setRenderError(null); handleReset(); }} className="btn-primary text-sm">重新开始</button>
        </div>
      </div>
    );
  }
  // Generate dynamic briefing content based on scenario category and role
  const getBriefingContent = (scenario: any, role: any) => {
    const name = role.name || '该客户';
    const cat = (scenario.category || '').toLowerCase();
    const diff = (scenario.difficulty || 'MEDIUM').toUpperCase();
    const region = role.region || '';
    const traits = (role.personalityTraits || '').toLowerCase();
    const commStyle = (role.communicationStyle || '').toLowerCase();
    const decisionStyle = (role.decisionStyle || '').toLowerCase();
    const painPoints = (role.painPoints || '').toLowerCase();
    const productFocus = (role.productFocus || '');
    const pos = (role.position || '').toLowerCase();

    // 地区特征
    const isMidEast = /中东|沙特|阿联酋|伊拉克|伊朗/.test(region);
    const isEurope = /欧洲|挪威|英国|法国|德国/.test(region);
    const isRussia = /俄罗斯/.test(region);
    const isNorthAm = /北美|美国|加拿大/.test(region);
    const isSEAsia = /东南亚|印尼|马来西亚/.test(region);
    const isChina = /中国/.test(region);
    const isJapan = /日本/.test(region);
    const isCentralAsia = /中亚|哈萨克/.test(region);
    const isSouthAm = /南美|巴西/.test(region);
    const isAustralia = /澳洲/.test(region);
    const isIndia = /印度/.test(region);

    // 角色特征标签
    const isTech = /技术|工程|研发|engineer|techni/.test(traits) || /技术|工程|研发/.test(pos);
    const isCostSensitive = /成本|预算|价格/.test(decisionStyle) || /价格/.test(traits);
    const isSlowDecision = /慢|委员会|审批|官僚/.test(decisionStyle);
    const isFastDecision = /快|迅速|直接/.test(decisionStyle);
    const isRelationship = /关系|面子|人情|harmony/.test(traits) || /关系/.test(commStyle);
    const isFormal = /正式|官僚|流程|compliance/.test(commStyle);
    const isDirect = /直接|强势|tough/.test(commStyle);
    const isConservative = /保守|谨慎|风险/.test(decisionStyle);

    // ---------- 对方诉求：根据场景+地区+角色组合出不同版本 ----------
    let need = '';
    const r = Math.random(); // 同类别内用随机增加多样性
    const r2 = Math.random(); // 另一个随机数用于task，避免与need同步

    if (/初次|初次接触|破冰|展会|cold/i.test(cat)) {
      if (isMidEast) {
        need = r < 0.5
          ? `${name}在展会上和你初次碰面，礼貌客气但还没什么信任。中东的生意讲究"先交朋友再谈生意"，茶没喝三轮别急着掏报价单。他今天的任务就是先筛一遍供应商，你的目标是从"候选项"变成"有兴趣深入了解的那个"。`
          : `${name}愿意坐下来和你聊，但这只是中东石油圈里一次普通的供应商接触。他不会当场拍板任何事，但你的言谈举止会被默默打分——够不够专业、懂不懂行、值不值得约下一次正式会议。建立个人连接比展示产品参数更重要。`;
      } else if (isEurope) {
        need = r < 0.5
          ? `${name}对新的供应商持开放但审慎的态度。欧洲人做事按流程来，初次接触就是看一看、听一听，回去再对照技术标准一条条过。他不会表现得太热情，但不热情不代表没兴趣。`
          : `${name}在考虑换供应商的可能性，但只有成本下降或技术提升的幅度够大才会真的行动。他需要被你"说服"换人是有价值的，而不是为了换而换。准备充分的对比数据和案例，别光说"我们很好"。`;
      } else if (isRussia) {
        need = `${name}认识你之后直截了当地问了几个关键问题——资质、经验、有没有本地支持。俄罗斯人谈生意不拐弯，问什么就是在意什么。他对新供应商天然有戒心，但如果你能证明自己经得起西伯利亚的考验，他会越来越认真。`;
      } else if (isSEAsia) {
        need = r < 0.5
          ? `${name}通过邮件或中间人找到了你。东南亚的采购决策很看重"这个人靠谱不靠谱"，技术规格反而是第二位的。他会从闲聊中判断你的为人——是不是可信、有没有诚意、会不会出了货就不管了。`
          : `${name}对你的产品好奇但还没完全信服。印尼市场对价格敏感，但他不会直接说预算有限——那样"丢面子"。你需要从他的含蓄回应中读懂暗示，比如"你们有没有更经济的方案"其实就是在说"便宜点"。`;
      } else if (isNorthAm) {
        need = `${name}开门见山表明了来意——他对现有供应商不满意才会见你。北美客户效率至上，你只有15分钟让他觉得"这个人值得继续聊"。他想要的是清晰的价值主张，不是产业背景介绍。直奔主题，别浪费他的时间。`;
      } else {
        need = r < 0.5
          ? `${name}第一次和你接触，手头确实有采购的意向，但还没决定具体方向和供应商。他还在评估阶段，不会一上来就亮底牌。`
          : `${name}给了你一个接触的机会，但这不代表什么——他同时也在和别的供应商聊。你的目标是在这场"海选"中脱颖而出，让他在众多候选里记住你的名字。`;
      }
    } else if (/技术|评审|方案/i.test(cat)) {
      if (isTech) {
        need = r < 0.5
          ? `${name}是技术出身，已经看过你的产品资料了，但他有几个技术疑问需要你当面澄清。他不吃销售话术那一套，只看具体参数和真实案例。你每个技术声明都要有据可查——数据能追溯到测试报告的那种。`
          : `${name}对你的方案感兴趣，但同时也是你最难糊弄的人。他会从技术细节入手测试你的功底——上一个项目怎么做的、故障怎么处理的、数据怎么测出来的。答不上来就直接出局，没有"我回头发给您"的机会。`;
      } else {
        need = r < 0.5
          ? `${name}需要对你的技术方案做一次正式评估，不通过就没有后续了。他关注的是方案能不能解决实际问题，不是听你吹产品多好。准备充分的技术数据和现场案例至关重要。`
          : `${name}虽然不是技术背景，但背后有技术团队把关。他会把你的回答转述给工程师们判断真假。所以你说的每一个技术声明都要能经得起"二级审查"——工程师们会放大检视的。`;
      }
    } else if (/谈判|价格|签约/i.test(cat)) {
      if (isCostSensitive) {
        need = r < 0.5
          ? `${name}已经到了比价阶段，他手里大概率有竞争对手的报价。他对成本极其敏感，你的每一块钱都要解释得通——原材料、工艺、运费、税费，拆开来看。准备好降价的底线和替代方案。`
          : `${name}看中了你的产品，但你的价格超出了他的预算。他不是在"砍价"，而是真的只有这么多钱。如果你不能在这个预算内给出方案，他只能去选那个便宜一点的竞品。`;
      } else if (isSlowDecision) {
        need = `${name}基本认可了你的产品，现在要进入正式的采购流程了。但大公司的流程是出了名的慢——预算审批、法务审核、合规检查，层层关卡。他本人可能想推进，但被内部流程卡着。你的耐心和配合度直接影响他愿不愿意帮你推动内部流程。`;
      } else if (isRelationship) {
        need = `${name}觉得和你合作应该没问题，但价格还需要"做做样子"谈一下。东南亚的商务谈判更像是一场表演——双方都知道最终会成交，但必须走完讨价还价的流程，让彼此都觉得"我赢了"。他给你留了面子，你也得给他台阶下。`;
      } else {
        need = r < 0.5
          ? `${name}基本认可你的产品，现在进入商务条款谈判阶段。他关注价格、交期、付款条件这几个硬指标，同时也看长期合作的诚意。谈判桌上既要守底线也要适当灵活。`
          : `${name}已经锁定了你作为供应商候选，但还没最终签字。他现在进入了"抠细节"模式——保修期多长、违约金怎么算、付款节点能不能调整。这些条款谈判比价格谈判更磨人，但也是最后一关。`;
      }
    } else if (/危机|投诉|故障|紧急/i.test(cat)) {
      if (isEurope || isNorthAm) {
        need = `${name}的现场出了设备问题，生产停摆正在造成巨大损失。他现在非常急迫，没有心情听客套话。他要的是：你什么时候到、多久修好、怎么保证不再发生。合规和流程文档可以事后补，现在先解决问题。`;
      } else if (isMidEast) {
        need = `${name}遇到了棘手的现场故障，他的老板在给他压力，语气比平时急了很多。中东的危机处理很看重"这个人靠不靠得住"——你到现场的速度、解决问题的态度、事后跟进的力度，比事故本身更能定义你在对方心中的形象。`;
      } else {
        need = `${name}遇到了紧急情况，现在非常着急。他需要快速解决方案，没耐心听长篇大论。你必须在最短时间内给出可行的应急方案，先解决眼前问题再谈后续合作。`;
      }
    } else if (/战略|长期|框架|大客户/i.test(cat)) {
      if (isMidEast) {
        need = `${name}考虑的是三年五年的长期合作框架，不是一单两单的买卖。沙特阿美这类大客户要的不是产品，是"合作伙伴"——你愿不愿意在本地建厂、能不能培养本地技术人才、有没有长期投入的决心。短期利润不是他的关注点。`;
      } else if (isChina) {
        need = `${name}想和你签一个覆盖多个海外项目的框架协议。中国油服出海的企业最看重的是一站式服务和价格优势。他对国内供应商天然有亲近感，但也很清楚低价竞争的套路。他想要的是"国内的成本、国际的质量"。`;
      } else {
        need = `${name}考虑的是长期合作而不是一锤子买卖。他关心的是你的公司实力、服务能力、供货稳定性这些战略层面的东西。你需要展示的不只是产品，而是作为合作伙伴的综合价值。`;
      }
    } else if (/商务|拜访|一般/i.test(cat)) {
      need = isDirect
        ? `${name}是典型的行动派客户，开门见山没有废话。他不喜欢发邮件等回复那一套，有什么问题当场就问、当场要答案。你的回复速度和对业务的熟悉程度决定了他对你的评价。`
        : `${name}是典型的商务型客户，关注效率和结果。他不喜欢绕弯子，希望你直接说清楚你能提供什么、价格多少、交期多长。简洁明了比客套寒暄更有效。`;
    } else if (/认证|审核|合规|audit/i.test(cat)) {
      if (isEurope) {
        need = `${name}严格按照公司流程在做供应商准入审核。欧洲公司的合规要求极其细致——环保标准、人权条款、数据安全，一个都不能少。这不是针对你个人，这是公司制度。别嫌烦，逐条配合就好。`;
      } else if (isRussia) {
        need = `${name}需要你通过一大堆认证和合规审查才能继续推进。俄罗斯市场受制裁影响，很多常规操作现在都走不通了。他不是在刁难你，而是真的需要你帮他找到"合规的解决方案"。`;
      } else {
        need = `${name}正在做供应商审核，这是走流程但也是硬门槛。证书、资质、案例这些材料缺一不可。别想着蒙混过关——他手里有一张检查清单，逐条核对的。`;
      }
    } else if (/关系|建立|初访/i.test(cat)) {
      need = isSEAsia || isChina
        ? `${name}愿意和你见面已经是个好信号。这类市场做生意很讲缘分——他觉得"你这个人不错"比"你们公司参数好看"重要得多。先聊行业、聊项目、聊共同认识的人，把关系基础打好了，生意自然就来了。`
        : `${name}愿意和你见面已经是个好开始，但他并不急于做决定。这次对话的目标是建立信任，而不是达成交易。多聊行业趋势和对方公司的业务痛点，少谈产品细节。`;
    } else {
      // 通用 + 地区适配
      if (isRussia) {
        need = `${name}对供应商比较挑剔——俄罗斯市场见过太多"说得很好做不到"的供应商了。他需要你用实际行动证明可靠性，而不是靠嘴说。问什么答什么，别夸夸其谈，俄罗斯人最反感这个。`;
      } else if (isSEAsia) {
        need = `${name}有采购需求但预算约束很明显。他不会直接说"太贵了"，而是会委婉地问"有没有其他方案"。作为销售，你得学会听弦外之音。他对技术培训的需求可能比产品本身更大——因为他的人不会用。`;
      } else {
        need = `${name}手头有采购需求，但不会轻易亮底牌。你需要通过有层次的提问逐步获取信息——先了解业务背景，再摸需求方向，最后才确认具体参数和预算。一步到位是不可能的。`;
      }
    }

    // ---------- 你的任务 ----------
    let task = '';

    if (/初次|初次接触|破冰|展会|cold/i.test(cat)) {
      if (isMidEast) {
        task = '先寒暄、聊行业、建立个人连接。中东客户喜欢在轻松的氛围里谈事情，别上来就掏报价。留个好印象，让他主动说"我们约个正式会议聊聊"。第一印象决定了是进门还是被挡在门口。';
      } else if (isEurope) {
        task = '专业、克制、有准备。欧洲客户欣赏"言之有物"的交流方式。提前了解他们的公司和项目背景，提出有针对性的问题。与其滔滔不绝介绍自己，不如让对方觉得"这个人懂我们的业务"。';
      } else if (isSEAsia) {
        task = '温和、耐心、多听少说。东南亚客户不习惯被步步紧逼的推销方式。先建立舒适感，用请教的态度聊他们的市场，对方会慢慢打开话匣子。记住：第一次的目标是让对方记住你这个人，不是卖掉产品。';
      } else if (isNorthAm) {
        task = '直接、清晰、有数据支撑。北美客户不吃寒暄客套那一套，上来就想知道你能给他带来什么价值。准备一个30秒的电梯演讲——你是谁、你解决什么问题、为什么选你。时间就是金钱，别浪费他的。';
      } else {
        task = r2 < 0.5
          ? '首要目标是打破陌生感、建立专业第一印象。多问开放性问题了解他的业务背景和关注点，少说自己产品多好。能让对方愿意和你约下一次沟通就算成功。'
          : '不要急着推销产品。先判断对方是决策人还是信息收集者、是真有预算还是在做市场调研。通过提问摸清他的角色和动机，再调整沟通策略。';
      }
    } else if (/技术|评审|方案/i.test(cat)) {
      const techWarning = isConservative
        ? ` ${name}技术决策偏保守，对未经充分验证的新技术有天然戒心。你有现场应用数据会比任何实验室报告都有说服力。` : '';
      if (diff === 'HARD' || diff === 'EXPERT') {
        task = `对方是行业里的技术专家，你说错一个数据就可能失去整场信任。提前准备好技术规格表、认证证书和至少两个相似的现场应用案例。回答要精准简洁，不知道的就老实说"我查证后回复你"。${techWarning}`;
      } else {
        task = r2 < 0.5
          ? `准备好技术数据和现场应用案例，用事实说话。先理解对方的技术关切点再针对性回应，不要照本宣科。如果被问住了，坦然承认并承诺跟进比胡乱回答好。${techWarning}`
          : `技术评审的核心不是"你答对了多少"，而是"你给人的感觉专不专业"。说话有依据、数据能溯源、被质疑时不慌不乱——做到这三点，技术评审就能过。${techWarning}`;
      }
    } else if (/谈判|价格|签约/i.test(cat)) {
      if (isCostSensitive) {
        task = r2 < 0.5
          ? '先探清楚预算区间再亮价格。报价时把价值拆解开——价格不是"多少钱"而是"能省多少钱"。准备好阶梯报价方案，让对方在"贵但更好"和"便宜够用"之间做选择，而不是在"买"和"不买"之间抉择。'
          : '别一上来就降价。先确认对方是真的预算不够还是在探底价。如果是真预算不够，帮他做减法——砍掉非核心配置、调整交期换价格。如果是探底价，坚持住你的价值定位。';
      } else if (isSlowDecision) {
        task = '耐心是你最好的武器。大公司采购流程慢是常态，别催太紧让对方反感。帮他准备好所有内部审批需要的材料——比价表、技术评估报告、风险评估——你帮他扫清内部障碍，他自然会帮你推动。';
      } else if (isRelationship) {
        task = '东南亚的谈判是一场有节奏的舞蹈。先给一个略高的报价让对方有砍价的空间和成就感，然后逐步让步，每次让步都换取一个条件——"价格可以调，但付款条件能不能配合一下？"最后双方都觉得自己赢了。';
      } else {
        task = r2 < 0.5
          ? '先搞清楚对方的预算区间和决策标准再报价。报价时锚定价值而非价格——强调TCO而不是单价。准备好一到两个让步方案，让对方觉得赢了这场谈判。'
          : '谈判进入最后阶段不要掉以轻心。很多销售在"差不多成了"的时候松懈，结果在付款条件或质保条款上翻了船。逐条确认、落实到邮件，别口头承诺。';
      }
    } else if (/危机|投诉|故障|紧急/i.test(cat)) {
      task = r2 < 0.5
        ? '先共情，再解决问题。承认问题的严重性，给出明确的修复时间表，然后超额补偿。处理得好，危机可以转化为建立深度信任的机会。处理不好，这个客户就丢了。'
        : `先别急着解释原因——${name}现在不需要知道"为什么会出问题"，他需要知道"什么时候能修好"。给明确的解决时间并提前到达，比任何解释都更能安抚客户。问题解决后再做根因分析和预防措施汇报。`;
    } else if (/战略|长期|框架|大客户/i.test(cat)) {
      task = isMidEast
        ? '展示你的长期投入意愿——是否有本地化的计划、如何培养本地团队、备件库的覆盖范围。中东大客户不是在看"你这次能提供什么"，而是在看"你未来五年能不能陪我们一起走"。画大饼没有用，要有具体的时间表和资源承诺。'
        : '展示你的公司实力和长期服务能力。准备公司介绍、客户案例、服务网络覆盖图这些能体现综合实力的材料。提出合作框架而不是单次交易。要谈的是"我们如何一起做大"而不是"这次能买多少"。';
    } else if (/认证|审核|合规|audit/i.test(cat)) {
      task = '把所有资质证书、认证文件整理好，按对方要求的顺序排列。回答要客观精确，不要夸大或模糊。审核就是考试，每道题都要有据可查。通过审核后才有资格进入下一轮实质谈判。提前了解对方最看重哪几项认证，重点准备。';
    } else if (/商务|拜访|一般/i.test(cat)) {
      task = isDirect
        ? `准备好清晰的报价单和产品摘要，对方问什么答什么。${name}喜欢"和明白人打交道"，你对业务的熟悉程度直接决定他对你的评价。多余的寒暄和模糊的回答反而会减分。`
        : '直接、高效、不绕弯子。准备好报价单和产品规格表，对方问什么答什么。多余的寒暄和无关信息反而会让这种客户觉得你不专业。';
    } else {
      if (isRussia) {
        task = '话少一点，事实多一点。俄罗斯客户不喜欢花哨的演示文稿，他要的是实实在在的数据和案例。能用数字说话就别用形容词。';
      } else if (isSEAsia) {
        task = '温和、耐心、注重售后服务承诺。东南亚客户买的不只是产品，还有"你以后会不会管我"。明确的技术培训计划和售后响应时间比你降价10%更有吸引力。';
      } else {
        task = '别急着报价，先用提问打开局面。了解对方的业务背景、关注点、决策流程，建立专业信任感，再适时展示产品优势。能拿到询价或订单就算漂亮。';
      }
    }

    // 难度附加提示
    if (diff === 'HARD') {
      const hardTips = [
        ' 这个场景难度不低，对方经验丰富或要求苛刻，每句话都要有分量。',
        ' 难度较高，建议提前准备充分的技术资料和案例数据，不要临场发挥。',
        ' 难度偏高，对方可能是在测试你的底线。稳住节奏，别被带偏。',
      ];
      task += hardTips[Math.floor(Math.random() * hardTips.length)];
    } else if (diff === 'EXPERT') {
      task += ' ⚠️ 顶级难度。这场对话是"专业程度的终极考验"，任何不严谨、不准确、不专业的表达都可能让你直接出局。对每一句话负责。';
    }

    // 角色特征附加提示（随机混入，增加多样性）
    const extras: string[] = [];
    if (isFormal && Math.random() < 0.5) extras.push(`${name}沟通风格偏正式，用词和语气也请保持专业和礼貌。`);
    if (isDirect && Math.random() < 0.5) extras.push(`${name}说话很直，你也别绕弯子——他欣赏有话直说的人。`);
    if (isRelationship && Math.random() < 0.5) extras.push(`${name}比较看重人情味，适当聊聊行业见闻和共同认识的人有助于拉近距离。`);
    if (isConservative && Math.random() < 0.5) extras.push(`${name}决策偏保守，引用数据和案例来支撑你的观点会比他更放心。`);
    if (isFastDecision && Math.random() < 0.5) extras.push(`${name}决策快，如果你表现得好他可能当场推动下一步。做好准备。`);
    if (painPoints.includes('培训') && Math.random() < 0.5) extras.push(`${name}很在意技术培训支持，可以主动提一下你们的培训计划和售后体系。`);
    if (productFocus && productFocus.length > 5 && Math.random() < 0.3) {
      const focus = productFocus.split(/[,，、]/)[0].trim().slice(0, 30);
      if (focus) extras.push(`他关注的产品方向是${focus}，聊到这个的时候可以多说两句。`);
    }

    const extraHint = extras.length > 0 ? ' ' + extras.join(' ') : '';

    // 将extraHint分割——一部分给need，一部分给task，避免重复
    const mid = Math.ceil(extras.length / 2);
    const needExtras = extras.slice(0, mid).join(' ');
    const taskExtras = extras.slice(mid).join(' ');

    return {
      need: need + (needExtras ? ' ' + needExtras : ''),
      task: task + (taskExtras ? ' ' + taskExtras : ''),
    };
  };

  try {
    return (
    <>
    <div className="flex flex-col h-full min-h-0" style={kbOffset > 0 ? { paddingBottom: kbOffset + 'px' } : undefined}>
      <div className="shrink-0 flex items-start justify-between py-2 border-b border-secondary-200/50">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-primary-600 shrink-0" />
            <h2 className="font-bold text-sm truncate">陪练室 · {safeRoleName(selectedRoleId)}</h2>
            {messages.length > 0 && (
              <span className="text-[11px] text-secondary-400 bg-secondary-100 px-1.5 py-0.5 rounded-full shrink-0">
                {Math.floor(messages.filter(m => m.role === 'USER').length)} 轮
              </span>
            )}
            {isChatting && (
              <span className="flex items-center gap-1 text-[10px] text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full shrink-0">
                <span className="w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                输入中
              </span>
            )}
          </div>
          {selectedRoleId && (() => {
            try {
              const role = safeRole(selectedRoleId);
              if (!role) return null;
              const scenario = safeScenario(selectedScenarioId);
              return (
                <div className="flex items-center gap-2 text-[11px] text-secondary-400 ml-7">
                  <span className="truncate">{role.position || '未知职位'} · {role.region || '未知地区'}</span>
                  {role.coreTags && <span className="hidden sm:inline text-secondary-300">|</span>}
                  {role.coreTags && <span className="hidden sm:inline truncate">{role.coreTags}</span>}
                  {scenario && <><span className="text-secondary-300">·</span><span className="truncate">{scenario.title || '未知场景'}</span></>}
                </div>
              );
            } catch { return null; }
          })()}
        </div>
        <div className="flex gap-1 sm:gap-2 shrink-0">
          <button onClick={togglePause} className={`btn-ghost text-xs ${isPaused ? 'text-amber-600' : ''}`}>
            {isPaused ? <Play size={14} /> : <PauseCircle size={14} />} <span className="hidden sm:inline">{isPaused ? '继续' : '暂停'}</span>
          </button>
          <button onClick={handleReset} className="btn-ghost text-xs"><RotateCcw size={14} /> <span className="hidden sm:inline">重新开始</span></button>
          <button onClick={handleEnd} className="btn-primary text-xs"><Flag size={14} /> <span className="hidden sm:inline">结束</span></button>
        </div>
      </div>

      {/* 信息折叠按钮（仅手机端显示） */}
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="sm:hidden flex items-center gap-1 px-2 py-1 text-[10px] text-secondary-400 hover:text-secondary-600 transition-colors shrink-0"
      >
        {showInfo ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showInfo ? '收起信息栏' : '展开人物与场景信息'}
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${showInfo ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 sm:max-h-full sm:opacity-100'}`}>
        <div className="shrink-0">{renderAmberBanner()}</div>
        <div className="shrink-0">{renderBriefingCard()}</div>
      </div>

      <div className="flex-1 min-h-0 relative my-3">
          <div ref={chatContainerRef} className="bg-white rounded-xl border border-secondary-200 overflow-y-auto p-2 sm:p-4 h-full overscroll-contain">
            <div className="flex flex-col min-h-full justify-end">
            {messages.filter(m => m.role !== 'SYSTEM').map(m => (
              <div key={m.id} className={`flex flex-col ${m.role === 'USER' ? 'items-end' : 'items-start'} ${m === messages[messages.length - 1] ? '' : 'mb-3'}`}>
                <div className="group relative">
                  {/* Quote button */}
                  <button
                    onClick={() => handleQuote(m)}
                    className={`absolute -top-3 ${m.role === 'USER' ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 bg-white border border-secondary-300 rounded-lg shadow-sm hover:bg-secondary-100 z-10`}
                    title="引用此消息"
                  >
                    <Reply size={14} className="text-primary-600" />
                  </button>
                  <div className="flex items-end gap-1 sm:gap-2">
                    {/* AI avatar — only for AI messages */}
                    {m.role === 'ASSISTANT' && (
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatar(safeRoleName(selectedRoleId)).gradient} flex items-center justify-center shrink-0 shadow-sm mb-0.5`}>
                        <span className="text-white font-bold text-[9px]">{getAvatar(safeRoleName(selectedRoleId)).initials}</span>
                      </div>
                    )}
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words max-w-[600px] ${
                      m.role === 'USER' 
                        ? 'bg-primary-600 text-white rounded-br-md' 
                        : m.role === 'ASSISTANT' 
                          ? 'bg-secondary-100 text-secondary-800 rounded-bl-md' 
                          : 'bg-amber-50 text-xs'
                    }`}>
                      {m.role === 'USER' ? (
                        <div>{m.content}</div>
                      ) : m.role === 'ASSISTANT' ? (
                        formatMessage(m.content)
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                </div>
                {/* Timestamp + Read status — outside bubble, like WhatsApp */}
                <div className="flex items-center gap-1.5 mt-0.5 px-1">
                  {m.createdAt && (
                    <span className="text-[10px] text-secondary-400">
                      {new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {m.role === 'USER' && readStatus[m.id] && (
                    readStatus[m.id] === 'read' 
                      ? <CheckCheck size={14} className="text-blue-500" /> 
                      : <Check size={14} className="text-blue-400" />
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {/* Pause overlay */}
          {isPaused && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 text-center shadow-sm border border-amber-200">
                <PauseCircle size={40} className="mx-auto mb-2 text-amber-500" />
                <p className="font-medium text-secondary-700 text-sm">对话已暂停</p>
                <p className="text-xs text-secondary-500 mt-1">点击顶部「继续」按钮恢复</p>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Input area */}
        <div className="shrink-0 bg-white rounded-xl border border-secondary-200 p-2 sm:p-3 shadow-sm">
          <div className="flex flex-col gap-2">
            {/* Selected files indicator */}
            {selectedFiles.length > 0 && (
              <div className="bg-secondary-50 rounded-lg divide-y divide-secondary-100 max-h-[100px] overflow-y-auto">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 sm:px-3 py-1.5 text-xs text-secondary-600">
                    <FileText size={14} className="text-primary-500 shrink-0" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-secondary-400 shrink-0">({(f.size / 1024).toFixed(1)} KB)</span>
                    <button onClick={() => handleRemoveFile(i)} className="p-0.5 hover:bg-secondary-200 rounded transition-colors shrink-0" title="移除文件">
                      <X size={14} className="text-secondary-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Quoted message bar */}
            {quoteTarget && (
              <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                <Reply size={12} className="text-purple-500 shrink-0" />
                <span className="text-xs text-purple-700 truncate flex-1">
                  <span className="font-medium">{quoteTarget.sender}</span>: {quoteTarget.content.slice(0, 50)}{quoteTarget.content.length > 50 ? '...' : ''}
                </span>
                <button onClick={handleCancelQuote} className="p-0.5 hover:bg-purple-100 rounded transition-colors shrink-0">
                  <X size={12} className="text-purple-400" />
                </button>
              </div>
            )}
            {/* Paused indicator */}
            {isPaused && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <PauseCircle size={14} className="text-amber-500 shrink-0" />
                <span className="flex-1">对话已暂停，点击顶部「继续」按钮恢复</span>
              </div>
            )}
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isPaused}
              className="btn-secondary px-2 sm:px-3 shrink-0"
              title="上传文件"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt" onChange={handleFileSelect} className="hidden" />
            <textarea
              ref={textareaRef}
              value={input}
              onFocus={scrollToBottom}
              onChange={e => {
                setInput(e.target.value);
                // Auto-resize textarea
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
              onKeyDown={e => {
                // Ctrl+Enter or Enter to send
                if ((e.key === 'Enter' && !e.shiftKey) && !isPaused && input.trim()) {
                  e.preventDefault();
                  handleSend();
                  setTimeout(() => { if (textareaRef.current) textareaRef.current.style.height = 'auto'; }, 0);
                }
                // Esc in textarea: close quote/file selections
                if (e.key === 'Escape') {
                  if (quoteTarget) { setQuoteTarget(null); e.preventDefault(); }
                  else if (selectedFiles.length > 0) { setSelectedFiles([]); setPendingFiles([]); e.preventDefault(); }
                }
              }}
              placeholder={isPaused ? "对话已暂停..." : "输入回复...（Enter发送）"}
              disabled={isPaused}
              rows={1}
              className="input flex-1 text-sm resize-none overflow-y-auto min-h-[38px] max-h-[80px] sm:max-h-[120px] leading-relaxed py-2.5"
            />
            <button
              onClick={handleSend}
              disabled={(isPaused || uploading) || (!input.trim() && pendingFiles.length === 0)}
              className="btn-primary px-2 sm:px-3 shrink-0 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          </div>
        </div>
      </div>
      {/* Completed report view — shown after evaluation completes */}
      {completedReportId && (
        <div className="fixed inset-0 z-50 bg-white animate-fade-in overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6">
            <div className="text-center mb-6 pt-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Award size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-secondary-900">评估完成！</h2>
              <p className="text-sm text-secondary-500 mt-1">查看详细评估报告</p>
            </div>

            {/* 整理初步评价 — shown below the title */}
            {preliminaryReport && (
              <div className="mb-6">
                {/* Overall Score */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${preliminaryReport.overallScore >= 80 ? 'text-green-600' : preliminaryReport.overallScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {preliminaryReport.overallScore}
                    </div>
                    <div className="text-xs text-secondary-500">总分</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-secondary-900">
                      {preliminaryReport.orderType === '正式订单' ? '🏆' : preliminaryReport.orderType === '预订单' ? '📋' : '✗'}
                    </div>
                    <div className="text-xs text-secondary-500">{preliminaryReport.orderType || '丢单'}</div>
                  </div>
                </div>

                {/* Dimensions quick view */}
                {(() => {
                  let dims: any[] = [];
                  try { dims = JSON.parse(preliminaryReport.radarData || '[]'); } catch {}
                  dims.sort((a, b) => a.score - b.score);
                  if (dims.length === 0) return null;
                  return (
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <h3 className="text-xs font-semibold text-secondary-500 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 size={14} /> 各维度得分
                      </h3>
                      <div className="space-y-2">
                        {dims.map((d, i) => {
                          const scoreColor = d.score >= 80
                            ? { bar: 'bg-green-500', text: 'text-green-600' }
                            : d.score >= 60
                              ? { bar: 'bg-amber-500', text: 'text-amber-600' }
                              : { bar: 'bg-red-500', text: 'text-red-600' };
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-secondary-600 w-20 shrink-0 truncate">{d.dimension}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div className={`h-2 rounded-full ${scoreColor.bar}`} style={{ width: `${d.score}%` }} />
                              </div>
                              <span className={`text-xs font-bold w-6 text-right ${scoreColor.text}`}>{d.score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Quick summary: strengths + improvement points */}
                {preliminaryReport.strengths && (
                  <div className="flex items-start gap-2 mb-2">
                    <ThumbsUp size={14} className="text-green-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{preliminaryReport.strengths}</p>
                  </div>
                )}
                {preliminaryReport.weaknesses && (
                  <div className="flex items-start gap-2 mb-4">
                    <ThumbsDown size={14} className="text-red-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{preliminaryReport.weaknesses}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button onClick={() => handleGoToFullReport(completedReportId!)} className="btn-primary py-3 text-base">
                <FileText size={18} /> 查看完整报告
              </button>
              <button onClick={handleCloseCompleted} className="btn-secondary py-3 text-base">
                <RotateCcw size={18} /> 开始新的陪练
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{display: 'contents'}}>
        {isEvaluating && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-xs w-full mx-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Loader2 size={28} className="text-white animate-spin" />
              </div>
              <h3 className="font-bold mb-1">正在评估...</h3>
              <p className="text-xs text-secondary-500 mb-3">AI正在分析对话表现</p>
              <div className="w-full bg-secondary-100 rounded-full h-2">
                <div className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-primary-700 transition-all duration-500" style={{ width: `${evalProgress}%` }} />
              </div>
              <p className="text-xs text-secondary-400 mt-1">{evalProgress}%</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
  } catch (e: any) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="text-red-500 font-bold text-lg mb-2">⛔ 系统进入错误</div>
          <p className="text-sm text-secondary-500 mb-1">陪练室渲染异常，请重新开始</p>
          <p className="text-xs text-secondary-400 mb-4">{e?.message || '未知错误'}</p>
          <button onClick={() => { setRenderError(null); handleReset(); }} className="btn-primary text-sm">重新开始</button>
        </div>
      </div>
    );
  }
}
