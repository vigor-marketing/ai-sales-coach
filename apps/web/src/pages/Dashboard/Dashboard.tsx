import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, MessageSquare, FileText, ChevronRight, Award, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { deleteSession } from '../../api/apiClient';
import { API_BASE_PATH } from '../../config/app';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定删除此陪练记录？关联的聊天记录和评估报告也将一并删除，此操作不可撤销。')) return;
    try {
      await deleteSession(sessionId);
      setStats((prev: any) => prev ? { ...prev, recentSessions: prev.recentSessions.filter((s: any) => s.id !== sessionId) } : prev);
    } catch (err) {
      console.error(err);
      alert('删除失败，请重试');
    }
  };

  useEffect(() => {
    fetch(`${API_BASE_PATH}/training/sessions/stats`, {
      headers: { Authorization: `Bearer ${useAuthStore.getState().token}` }
    }).then(r => r.json().catch(() => null)).then(data => {
      if (data && data.totalSessions !== undefined) {
        setStats(data);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-danger';
  };

  if (loading) return <div className="p-8 text-center text-secondary-500">加载中...</div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">仪表盘</h2>
          <p className="text-sm text-secondary-500 mt-1">
            {user?.role === 'ADMIN' ? '主账号 · 查看所有数据' : `欢迎回来，${user?.name}`}
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full font-medium">主账号</span>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <MessageSquare size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">总训练次数</p>
              <p className="text-2xl font-bold text-secondary-900">{stats?.totalSessions || 0}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">预设角色</p>
              <p className="text-2xl font-bold text-secondary-900">{stats?.totalRoles || 0}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">评估报告</p>
              <p className="text-2xl font-bold text-secondary-900">{stats?.totalReports || 0}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Award size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">平均分</p>
              <p className={`text-2xl font-bold ${scoreColor(stats?.averageScore ?? 0)}`}>
                {stats?.averageScore != null ? stats.averageScore : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => navigate('/training')} className="card hover:shadow-md transition-shadow text-center py-6">
          <MessageSquare size={24} className="mx-auto mb-2 text-primary-600" />
          <p className="text-sm font-medium text-secondary-900">开始陪练</p>
        </button>
        <button onClick={() => navigate('/roles')} className="card hover:shadow-md transition-shadow text-center py-6">
          <Users size={24} className="mx-auto mb-2 text-primary-600" />
          <p className="text-sm font-medium text-secondary-900">查看角色</p>
        </button>
        <button onClick={() => navigate('/scenarios')} className="card hover:shadow-md transition-shadow text-center py-6">
          <BarChart3 size={24} className="mx-auto mb-2 text-primary-600" />
          <p className="text-sm font-medium text-secondary-900">管理场景</p>
        </button>
        <button onClick={() => navigate('/reports')} className="card hover:shadow-md transition-shadow text-center py-6">
          <FileText size={24} className="mx-auto mb-2 text-primary-600" />
          <p className="text-sm font-medium text-secondary-900">查看报告</p>
        </button>
      </div>

      {/* Recent Sessions - at the bottom */}
      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-secondary-900">最近陪练记录</h3>
          <button onClick={() => navigate('/training')} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            开始陪练 <ChevronRight size={16} />
          </button>
        </div>
        {stats?.recentSessions?.length > 0 ? (
          <div className="space-y-3">
            {stats.recentSessions.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3.5 bg-secondary-50 rounded-xl hover:bg-secondary-100 cursor-pointer transition-all group" onClick={() => navigate(`/reports/${s.id}`)}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-secondary-900 text-sm">{s.role?.name}</p>
                  <p className="text-xs text-secondary-500 mt-0.5 truncate">{s.role?.position} · {s.scenario?.title || '通用场景'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-xs text-secondary-400">{new Date(s.startedAt).toLocaleDateString('zh-CN')}</span>
                  {s.status === 'ACTIVE' || s.status === 'PAUSED' ? (
                    <button onClick={(e) => { e.stopPropagation(); localStorage.setItem('training_session_id', s.id); if (s.roleId) localStorage.setItem('training_role_id', s.roleId); if (s.scenarioId) localStorage.setItem('training_scenario_id', s.scenarioId); navigate('/training'); }}
                      className="text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-colors font-medium whitespace-nowrap shadow-sm shadow-primary-200">
                      继续对话
                    </button>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-success/10 text-success">已完成</span>
                  )}
                  {isAdmin && (
                    <button onClick={(e) => handleDeleteSession(s.id, e)}
                      className="p-1.5 text-secondary-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="删除此记录">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-secondary-500">
            <MessageSquare size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">还没有陪练记录，去开始第一次训练吧</p>
            <button onClick={() => navigate('/training')} className="mt-3 btn-primary text-sm">开始陪练</button>
          </div>
        )}
      </div>
    </div>
  );
}
