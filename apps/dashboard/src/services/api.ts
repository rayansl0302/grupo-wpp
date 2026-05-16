import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({ baseURL: BASE });

// Injeta token JWT em todo request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redireciona para /login se 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ─── Tipagens de retorno ──────────────────────────────────────────────────────

export interface Stats {
  campaigns: { total: number; active: number };
  groups: { total: number; active: number };
  posts: { total: number; failed: number; today: number };
  products: { total: number };
  scheduler: { active: number };
}

export interface ChartPoint { date: string; sent: number; failed: number }

export interface SentPost {
  id: string; sentAt: string; status: string;
  product: { title: string; salePrice: number; discount: number | null; thumbnail: string | null };
  group: { name: string };
  campaign: { name: string };
}

export interface Campaign {
  id: string; name: string; active: boolean; cronExpr: string;
  templateType: string; useAI: boolean; minDiscount: number;
  freeShipping: boolean; keywords: string; categories: string;
  _count?: { sentPosts: number };
  groups: Array<{ group: { name: string; jid: string } }>;
}

export interface Group {
  id: string; jid: string; name: string; active: boolean;
  dailyLimit: number; session: { name: string; status: string };
}

export interface Session {
  id: string; name: string; status: string; phoneNumber: string | null;
}

// ─── Funções de API ───────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { name: string; email: string } }>('/auth/login', { email, password }),
};

export const dashApi = {
  stats: () => api.get<Stats>('/dashboard/stats'),
  chart: () => api.get<ChartPoint[]>('/dashboard/chart'),
  history: (page = 1) => api.get<{ data: SentPost[]; total: number; pages: number }>(`/dashboard/history?page=${page}`),
  topProducts: () => api.get('/dashboard/top-products'),
};

export interface ServiceCheck {
  id: string;
  name: string;
  category: 'infra' | 'integration' | 'auth';
  status: 'ok' | 'warning' | 'error' | 'unknown';
  message: string;
  panelUrl: string;
  docsUrl?: string;
  expiresAt?: string;
  daysUntilExpire?: number;
  meta?: Record<string, any>;
}

export const servicesApi = {
  status: () => api.get<{
    summary: { total: number; ok: number; warning: number; error: number };
    services: ServiceCheck[];
  }>('/services/status'),
};

export interface AppLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  meta: any;
  createdAt: string;
}

export const logsApi = {
  list: (params?: { level?: string; source?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.level) search.set('level', params.level);
    if (params?.source) search.set('source', params.source);
    if (params?.limit) search.set('limit', String(params.limit));
    return api.get<{ total: number; showing: number; logs: AppLog[] }>(`/logs?${search}`);
  },
  summary: () => api.get<{ total: number; byLevel: Record<string, number>; bySource: Record<string, number> }>('/logs/summary'),
  clear: () => api.delete('/logs'),
};

export const campaignApi = {
  list: () => api.get<Campaign[]>('/campaigns'),
  get: (id: string) => api.get<Campaign>(`/campaigns/${id}`),
  create: (data: Partial<Campaign> & { groupIds: string[] }) => api.post<Campaign>('/campaigns', data),
  update: (id: string, data: Partial<Campaign> & { groupIds?: string[] }) =>
    api.patch<Campaign>(`/campaigns/${id}`, data),
  toggle: (id: string) => api.patch<Campaign>(`/campaigns/${id}/toggle`),
  run: (id: string) => api.post(`/campaigns/${id}/run`),
  test: (id: string) => api.post<{ sent: number; failed: number; product?: string }>(`/campaigns/${id}/test`),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
};

export const groupApi = {
  list: () => api.get<Group[]>('/whatsapp/groups'),
  toggle: (id: string) => api.patch<Group>(`/whatsapp/groups/${id}/toggle`),
  remove: (id: string) => api.delete(`/whatsapp/groups/${id}`),
  create: (data: { jid: string; name: string; sessionId: string; dailyLimit?: number }) =>
    api.post<Group>('/whatsapp/groups', data),
  update: (id: string, data: { name?: string; dailyLimit?: number; active?: boolean }) =>
    api.patch<Group>(`/whatsapp/groups/${id}`, data),
};

export const sessionApi = {
  list: () => api.get<Session[]>('/whatsapp/sessions'),
  create: (name: string) => api.post<{ sessionId: string; name: string; status: string }>('/whatsapp/sessions', { name }),
  getQr: (id: string) => api.get<{ qrCode: string | null; status: string }>(`/whatsapp/sessions/${id}/qr`),
  remove: (id: string) => api.delete(`/whatsapp/sessions/${id}`),
  fetchWhatsAppGroups: (sessionName: string) =>
    api.get<Array<{ jid: string; subject: string }>>(`/whatsapp/sessions/${sessionName}/groups`),
};
