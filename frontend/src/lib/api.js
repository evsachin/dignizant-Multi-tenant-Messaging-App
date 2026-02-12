import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  registerOrgAdmin: (data) => api.post('/auth/register-org-admin', data),
  me: () => api.get('/auth/me'),
};

// Users
export const usersAPI = {
  invite: (data) => api.post('/users/invite', data),
  list: () => api.get('/users'),
  remove: (userId) => api.delete(`/users/${userId}`),
};

// Groups
export const groupsAPI = {
  create: (data) => api.post('/groups', data),
  list: () => api.get('/groups'),
  get: (groupId) => api.get(`/groups/${groupId}`),
  delete: (groupId) => api.delete(`/groups/${groupId}`),
  addMember: (groupId, userId) => api.post(`/groups/${groupId}/members`, { userId }),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
};

// Messages
export const messagesAPI = {
  list: (groupId, params) => api.get(`/groups/${groupId}/messages`, { params }),
  send: (groupId, content) => api.post(`/groups/${groupId}/messages`, { content }),
};
