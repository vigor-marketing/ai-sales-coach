import { Component, useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_PATH } from './config/app';

// Error boundary — auto-reports to server, attempts recovery, then auto-reloads
const MAX_RETRIES = 2;
const RETRY_KEY = '__error_recovery_retry';

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean; countdown: number}> {
  timer: ReturnType<typeof setInterval> | null = null;
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, countdown: 3 };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info);
    // 1. Auto-report to server
    try {
      fetch(`${API_BASE_PATH}/errors/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack || '',
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {}

    // 2. Auto-clear stale localStorage (most common cause of crashes)
    try {
      localStorage.removeItem('training_session_id');
      localStorage.removeItem('training_role_id');
      localStorage.removeItem('training_scenario_id');
    } catch {}

    // 3. Check retry count, auto-reload if under limit
    const retries = parseInt(sessionStorage.getItem(RETRY_KEY) || '0', 10);
    if (retries < MAX_RETRIES) {
      sessionStorage.setItem(RETRY_KEY, String(retries + 1));
      // Show countdown then auto-reload
      this.setState({ countdown: 3 });
      this.timer = setInterval(() => {
        this.setState((prev: { countdown: number }) => {
          if (prev.countdown <= 1) {
            if (this.timer) clearInterval(this.timer);
            window.location.reload();
            return { countdown: 0 };
          }
          return { countdown: prev.countdown - 1 };
        });
      }, 1000);
    }
  }
  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }
  render() {
    if (this.state.hasError) {
      const retries = parseInt(sessionStorage.getItem(RETRY_KEY) || '0', 10);
      const willAutoReload = retries <= MAX_RETRIES;
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-secondary-50">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-danger/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-danger text-2xl">!</span>
            </div>
            <h2 className="text-xl font-bold text-secondary-900 mb-2">页面遇到了问题</h2>
            <p className="text-sm text-secondary-500 mb-4">错误已自动上报</p>
            {willAutoReload ? (
              <p className="text-xs text-secondary-400 mb-4">
                正在尝试自动恢复 {this.state.countdown} 秒后自动刷新...
              </p>
            ) : (
              <p className="text-xs text-secondary-400 mb-4">多次恢复失败，请手动刷新</p>
            )}
            <button onClick={() => { sessionStorage.removeItem(RETRY_KEY); window.location.reload(); }} className="btn-primary text-sm">
              立即刷新
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  LayoutDashboard, BookOpen, Users, MessageSquare, FileText, Settings, Menu, X, User, HardHat, Database, Brain, BarChart3
} from 'lucide-react';
import { useAuthStore } from './stores/authStore';
import Dashboard from './pages/Dashboard/Dashboard';
import KnowledgeBase from './pages/KnowledgeBase/KnowledgeBase';
import RoleManager from './pages/RoleManager/RoleManager';
import ScenarioManager from './pages/ScenarioManager/ScenarioManager';
import TrainingRoom from './pages/TrainingRoom/TrainingRoom';
import Reports from './pages/Reports/Reports';
import ReportDetail from './pages/Reports/ReportDetail';
import Analytics from './pages/Analytics/Analytics';
import SettingsPage from './pages/Settings/Settings';
import NotFound from './pages/NotFound/NotFound';
import StrategyInsights from './pages/StrategyInsights/StrategyInsights';
import ToastContainer from './components/Toast';

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auto-update page title based on current route
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': '仪表盘',
      '/training': '陪练室',
      '/roles': '角色管理',
      '/scenarios': '场景管理',
      '/knowledge': '知识库',
      '/reports': '评估报告',
      '/analytics': '跨会话分析',
      '/strategy': '策略洞察',
      '/settings': '系统设置',
    };
    const base = 'AI销售陪练';
    const key = Object.keys(titles).find(k => location.pathname === k || location.pathname.startsWith(k + '/'));
    document.title = key ? `${titles[key]} - ${base}` : base;
  }, [location.pathname]);

  const navGroups = [
    {
      label: '应用',
      items: [
        { path: '/', icon: LayoutDashboard, label: '仪表盘' },
        { path: '/training', icon: MessageSquare, label: '陪练室' },
        { path: '/reports', icon: FileText, label: '评估报告' },
        { path: '/analytics', icon: BarChart3, label: '跨会话分析' },
      ],
    },
    {
      label: '管理',
      items: [
        { path: '/roles', icon: Users, label: '角色管理' },
        { path: '/scenarios', icon: BookOpen, label: '场景管理' },
        { path: '/knowledge', icon: Database, label: '知识库' },
        ...(user?.role === 'ADMIN' ? [
          { path: '/strategy', icon: Brain, label: '策略洞察' },
          { path: '/settings', icon: Settings, label: '系统设置' },
        ] : []),
      ],
    },
  ];

  useEffect(() => { setMobileMenuOpen(false); }, [location]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-secondary-50 via-white to-secondary-100">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-white/90 backdrop-blur-xl border-r border-secondary-200/60 shadow-sm transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-secondary-100 shrink-0">
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-sm">
                <HardHat size={16} className="text-white" />
              </div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">AI销售陪练</h1>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-secondary-100 transition-colors">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        <nav className="flex-1 py-3 px-2.5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {sidebarOpen && (
                <p className="px-3 py-1 text-[11px] font-semibold text-secondary-400 uppercase tracking-[0.08em]">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.path !== '/' ? location.pathname.startsWith(item.path) : location.pathname === '/';
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-primary-50 to-primary-100/50 text-primary-700 font-medium shadow-sm'
                          : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-800'
                      }`}
                    >
                      <item.icon size={18} className={isActive ? 'text-primary-600' : ''} />
                      {sidebarOpen && <span className="truncate text-sm">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-secondary-200/60 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-sm">
            <HardHat size={16} className="text-white" />
          </div>
          <h1 className="text-base font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">AI销售陪练</h1>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-xl hover:bg-secondary-100 transition-colors">
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={() => setMobileMenuOpen(false)} />
      )}
      <div className={`md:hidden fixed top-14 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-secondary-200/60 shadow-soft transform transition-all duration-300 ${mobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none'}`}>
        <nav className="p-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 py-1 text-[11px] font-semibold text-secondary-400 uppercase tracking-[0.08em]">{group.label}</p>
              <div className="space-y-0.5 mt-1">
                {group.items.map((item) => {
                  const isActive = item.path !== '/' ? location.pathname.startsWith(item.path) : location.pathname === '/';
                  return (
                    <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                      isActive ? 'bg-gradient-to-r from-primary-50 to-primary-100/50 text-primary-700 font-medium' : 'text-secondary-600 hover:bg-secondary-50'
                    }`}>
                      <item.icon size={18} /> <span className="text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="border-t border-secondary-100 pt-3">
            {/* Quick actions */}
            {sidebarOpen && (
              <div className="px-3 pb-3">
                <p className="text-[10px] font-semibold text-secondary-400 uppercase tracking-[0.08em] mb-2">quick actions</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => navigate('/training')} className="text-[10px] bg-primary-50 text-primary-600 px-2.5 py-1.5 rounded-lg hover:bg-primary-100 transition-colors">+ new session</button>
                  <button onClick={() => navigate('/roles')} className="text-[10px] bg-secondary-50 text-secondary-600 px-2.5 py-1.5 rounded-lg hover:bg-secondary-100 transition-colors">roles</button>
                  <button onClick={() => navigate('/knowledge')} className="text-[10px] bg-secondary-50 text-secondary-600 px-2.5 py-1.5 rounded-lg hover:bg-secondary-100 transition-colors">knowledge</button>
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <main style={{ overflow: location.pathname === '/training' ? 'hidden' : 'auto' }} className={`flex-1 bg-gradient-to-br from-secondary-50 via-white to-secondary-100 ${sidebarOpen ? 'md:ml-0' : ''} pt-14 md:pt-0`}>
        <div className="h-full p-2 md:p-4 animate-fade-in flex flex-col ${location.pathname === '/training' ? 'pb-0 md:pb-4' : ''}" style={{ overflow: location.pathname === '/training' ? 'hidden' : undefined }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/training" element={<TrainingRoom />} />
            <Route path="/roles" element={<RoleManager />} />
            <Route path="/scenarios" element={<ScenarioManager />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id" element={<ReportDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/strategy" element={<StrategyInsights />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}

function WorkbenchAccessGate() {
  const { user, token, acceptWorkbenchToken } = useAuthStore();
  const [status, setStatus] = useState('正在与工作台确认身份…');
  useEffect(() => {
    let retryTimer: number | undefined;
    const requestIdentity = () => window.parent.postMessage(
      { type: 'vigor.workbench.auth.request.v1' },
      window.location.origin,
    );
    const receive = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'vigor.workbench.auth.response.v1' || typeof event.data.token !== 'string') return;
      if (retryTimer) window.clearInterval(retryTimer);
      try { await acceptWorkbenchToken(event.data.token); setStatus('身份已确认，正在进入陪练系统…'); }
      catch { setStatus('工作台身份验证失败，请返回工作台后重新打开陪练。'); }
    };
    window.addEventListener('message', receive);
    if (window.parent !== window) {
      requestIdentity();
      retryTimer = window.setInterval(requestIdentity, 1000);
    } else setStatus('AI 销售陪练仅可从 Vigor 工作台打开。');
    return () => {
      if (retryTimer) window.clearInterval(retryTimer);
      window.removeEventListener('message', receive);
    };
  }, [acceptWorkbenchToken]);
  if (token && user) return <ErrorBoundary><AppContent /></ErrorBoundary>;
  return <main className="min-h-screen grid place-items-center bg-[#17191b] p-6"><section className="w-full max-w-md border-t-2 border-[#d92d20] bg-[#f7f7f5] p-9 text-center shadow-[0_20px_50px_rgba(0,0,0,.28)]"><div className="mx-auto grid h-10 w-10 place-items-center bg-[#d92d20] text-lg font-bold text-white">V</div><p className="mt-5 text-[10px] font-semibold tracking-[.18em] text-[#717980]">VIGOR WORKBENCH</p><h1 className="mt-3 text-2xl font-bold tracking-tight text-[#17191b]">AI 销售陪练</h1><p className="mt-3 text-sm leading-6 text-[#657078]">{status}</p><a className="mt-7 inline-flex items-center border-b border-[#d92d20] pb-1 text-sm font-semibold text-[#a61b14]" href="/">返回工作台</a></section></main>;
}
export default function App() { return <WorkbenchAccessGate />; }
