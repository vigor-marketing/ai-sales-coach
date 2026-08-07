import axios from 'axios';

const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const api = axios.create({
  baseURL: `${appBasePath}/api`,
  timeout: 300000, // 5 minutes timeout for API calls (evaluation takes up to 5min)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-logout on 401 — clears stale tokens and redirects to login
api.interceptors.response.use(
  response => response,
  async error => {
    // Only retry GET requests, max 1 retry
    if (!error.response && error.code === 'ERR_NETWORK' && error.config?.method?.toLowerCase() === 'get') {
      console.warn('Network error on GET, retrying once in 2s...');
      await new Promise(r => setTimeout(r, 2000));
      return api.request(error.config);
    }
    // 401 Unauthorized — token expired or invalid, force logout
    if (error.response?.status === 401) {
      try {
        const { useAuthStore } = await import('../stores/authStore');
        useAuthStore.getState().logout();
      } catch {}
      window.location.assign(import.meta.env.BASE_URL);
    }
    return Promise.reject(error);
  }
);

// Health
export const getHealth = () => api.get('/health');

// Auth
export const login = (email: string, password: string) => api.post('/auth/login', { email, password });
export const getMe = () => api.get('/auth/me');

// Roles
export const getRoles = () => api.get('/roles');
export const getRole = (id: string) => api.get(`/roles/${id}`);
export const createRole = (data: unknown) => api.post('/roles', data);

// Scenarios
export const getScenarios = () => api.get('/scenarios');
export const getScenario = (id: string) => api.get(`/scenarios/${id}`);
export const createScenario = (data: unknown) => api.post('/scenarios', data);
export const updateScenario = (id: string, data: unknown) => api.put(`/scenarios/${id}`, data);
export const deleteScenario = (id: string) => api.delete(`/scenarios/${id}`);

// Knowledge
export const getKnowledgeEntries = () => api.get('/knowledge/entries');
export const createKnowledgeEntry = (data: unknown) => api.post('/knowledge/entries', data);
export const updateKnowledgeEntry = (id: string, data: unknown) => api.put(`/knowledge/entries/${id}`, data);
export const deleteKnowledgeEntry = (id: string) => api.delete(`/knowledge/entries/${id}`);
export const quickCreateKnowledge = (description: string) => api.post('/ai/quick-create-knowledge', { description });

// Training
export const getSessions = () => api.get('/training/sessions');
export const createSession = (data: unknown) => api.post('/training/sessions', data);
export const getMessages = (sessionId: string) => api.get(`/training/sessions/${sessionId}/messages`);
export const sendMessage = (sessionId: string, message: string) =>
  api.post(`/training/sessions/${sessionId}/chat`, { message });
export const evaluateSession = (sessionId: string) =>
  api.post(`/training/sessions/${sessionId}/evaluate`);
export const deleteSession = (sessionId: string) => api.delete(`/training/sessions/${sessionId}`);
export const updateSessionStatus = (sessionId: string, status: string) => api.patch(`/training/sessions/${sessionId}/status`, { status });

// Reports
export const getReports = () => api.get('/reports');
export const getReport = (id: string) => api.get(`/reports/${id}`);
export const deleteReport = (id: string) => api.delete(`/reports/${id}`);

// Analytics
export const getAnalytics = () => api.get('/stats/analytics');

// AI Quick Create
export const quickCreateScenario = (description: string) => api.post('/ai/quick-create-scenario', { description });
export const quickCreateRole = (description: string) => api.post('/ai/quick-create-role', { description });

export default api;
