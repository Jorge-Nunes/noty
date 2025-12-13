import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API response interface
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

// Auth API
export const authAPI = {
  login: async (email: string, password: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },

  verify: async (token: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/auth/verify', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  getProfile: async (token: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get('/auth/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  updateProfile: async (data: { name?: string; password?: string }): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.put('/auth/profile', data);
    return response.data;
  },
};

// Dashboard API
export const dashboardAPI = {
  getStats: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get('/dashboard/stats');
    return response.data;
  },

  getPaymentsChart: async (period: string = '30'): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/dashboard/payments-chart?period=${period}`);
    return response.data;
  },

  getRecentActivities: async (limit: number = 20): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/dashboard/recent-activities?limit=${limit}`);
    return response.data;
  },
};

// Clients API
export const clientsAPI = {
  getAll: async (params: any = {}): Promise<ApiResponse> => {
    const queryString = new URLSearchParams(params).toString();
    const response: AxiosResponse = await apiClient.get(`/clients?${queryString}`);
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/clients/${id}`);
    return response.data;
  },

  create: async (data: any): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/clients', data);
    return response.data;
  },

  update: async (id: string, data: any): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.put(`/clients/${id}`, data);
    return response.data;
  },

  toggleStatus: async (id: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.patch(`/clients/${id}/toggle-status`);
    return response.data;
  },

  toggleNotifications: async (id: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.patch(`/clients/${id}/toggle-notifications`);
    return response.data;
  },
};

// Payments API
export const paymentsAPI = {
  getAll: async (params: any = {}): Promise<ApiResponse> => {
    const queryString = new URLSearchParams(params).toString();
    const response: AxiosResponse = await apiClient.get(`/payments?${queryString}`);
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/payments/${id}`);
    return response.data;
  },

  getDueToday: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get('/payments/due/today');
    return response.data;
  },

  getOverdue: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get('/payments/status/overdue');
    return response.data;
  },

  getUpcomingWarnings: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get('/payments/warnings/upcoming');
    return response.data;
  },

  getStats: async (period: string = 'month'): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/payments/stats/summary?period=${period}`);
    return response.data;
  },
};

// Config API
export const configAPI = {
  getAll: async (category: string = 'all'): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/config?category=${category}`);
    return response.data;
  },

  getByKey: async (key: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/config/${key}`);
    return response.data;
  },

  // Public endpoint - no auth required
  getCompanyLogo: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await axios.get('/api/config/company-logo');
    return response.data;
  },

  create: async (data: any): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/config', data);
    return response.data;
  },

  update: async (key: string, data: any): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.put(`/config/${key}`, data);
    return response.data;
  },

  bulkUpdate: async (configs: any[]): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.put('/config/bulk/update', { configs });
    return response.data;
  },

  delete: async (key: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.delete(`/config/${key}`);
    return response.data;
  },

  testAsaas: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/config/test/asaas');
    return response.data;
  },

  testEvolution: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/config/test/evolution');
    return response.data;
  },
};

// Templates API
export const templatesAPI = {
  getAll: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get('/templates');
    return response.data;
  },

  getByType: async (type: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/templates/${type}`);
    return response.data;
  },

  save: async (type: string, data: any): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.put(`/templates/${type}`, data);
    return response.data;
  },

  delete: async (type: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.delete(`/templates/${type}`);
    return response.data;
  },

  test: async (type: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post(`/templates/${type}/test`);
    return response.data;
  },
};

// Automation API
export const automationAPI = {
  syncAsaas: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/automation/sync/asaas');
    return response.data;
  },

  sendWarnings: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/automation/send/warnings');
    return response.data;
  },

  sendOverdue: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/automation/send/overdue');
    return response.data;
  },

  sendManualMessage: async (data: any): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/automation/send/manual-message', data);
    return response.data;
  },

  getLogs: async (params: any = {}): Promise<ApiResponse> => {
    const queryString = new URLSearchParams(params).toString();
    const response: AxiosResponse = await apiClient.get(`/automation/logs?${queryString}`);
    return response.data;
  },

  getLogById: async (id: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/automation/logs/${id}`);
    return response.data;
  },

  getMessages: async (params: any = {}): Promise<ApiResponse> => {
    const queryString = new URLSearchParams(params).toString();
    const response: AxiosResponse = await apiClient.get(`/automation/messages?${queryString}`);
    return response.data;
  },

  getStatus: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get('/automation/status');
    return response.data;
  },
};

// Webhooks API
export const webhooksAPI = {
  stats: async (period?: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/webhooks/stats${period ? `?period=${period}` : ''}`);
    return response.data;
  },

  activities: async (limit?: number): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get(`/webhooks/activities${limit ? `?limit=${limit}` : ''}`);
    return response.data;
  },
};

// Traccar API interfaces
interface TraccarConfigResponse extends ApiResponse {
  config?: any;
}

interface TraccarStatusResponse extends ApiResponse {
  service?: any;
  stats?: any;
}

interface TraccarSyncResponse extends ApiResponse {
  summary?: any;
}

// Traccar API
export const traccarAPI = {
  getConfig: async (): Promise<TraccarConfigResponse> => {
    const response: AxiosResponse = await apiClient.get('/traccar/config');
    return response.data;
  },

  saveConfig: async (config: any): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post('/traccar/config', config);
    return response.data;
  },

  testConnection: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get('/traccar/test-connection');
    return response.data;
  },

  getUsers: async (): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.get('/traccar/users');
    return response.data;
  },

  syncClients: async (): Promise<TraccarSyncResponse> => {
    const response: AxiosResponse = await apiClient.post('/traccar/sync-clients');
    return response.data;
  },

  blockClient: async (clientId: string, reason: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post(`/traccar/clients/${clientId}/block`, { reason });
    return response.data;
  },

  unblockClient: async (clientId: string): Promise<ApiResponse> => {
    const response: AxiosResponse = await apiClient.post(`/traccar/clients/${clientId}/unblock`);
    return response.data;
  },

  getStatus: async (): Promise<TraccarStatusResponse> => {
    const response: AxiosResponse = await apiClient.get('/traccar/status');
    return response.data;
  }
};

// Exportação principal para compatibilidade com componentes Traccar
export const api = apiClient;

export default apiClient;