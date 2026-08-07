import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary-100 flex items-center justify-center">
        <span className="text-2xl font-bold text-secondary-400">404</span>
      </div>
      <h2 className="text-lg font-bold text-secondary-700 mb-2">页面不存在</h2>
      <p className="text-sm text-secondary-500 mb-6">你访问的页面不存在或已被移除</p>
      <button onClick={() => navigate('/')} className="btn-primary text-sm flex items-center gap-1.5">
        <ArrowLeft size={14} /> 返回首页
      </button>
    </div>
  );
}
