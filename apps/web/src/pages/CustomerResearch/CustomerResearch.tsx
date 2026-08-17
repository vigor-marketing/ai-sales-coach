import { useEffect } from 'react';

// 客户背调以 iframe 承载 MVP（同源静态资源 /customer-research/index.html），
// 复用工作台的鉴权：iframe 内从 localStorage('auth-storage') 读取 JWT 注入请求头。
export default function CustomerResearch() {
  useEffect(() => {
    document.title = '客户背调 - AI销售陪练';
  }, []);
  return (
    <div className="w-full h-full" style={{ height: '100%' }}>
      <iframe
        src="/customer-research/index.html"
        title="客户背调"
        className="w-full h-full border-0"
        style={{ minHeight: 'calc(100vh - 2rem)', display: 'block' }}
      />
    </div>
  );
}
