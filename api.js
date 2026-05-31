import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => {
  const t = localStorage.getItem('dn_token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export const Auth = {
  login:         (username, password) => api.post('/auth/login', { username, password }),
  register:      (username, displayName, password) => api.post('/auth/register', { username, displayName, password }),
  me:            () => api.get('/auth/me'),
  checkUsername: u => api.get(`/auth/check-username/${u}`),
};

export const Users = {
  list:        () => api.get('/users'),
  get:         id => api.get(`/users/${id}`),
  updateMe:    data => api.patch('/users/me', data),
  coins:       () => api.get('/users/me/coins'),
};

export const Messages = {
  get:    peerId => api.get(`/messages/${peerId}`),
  clear:  peerId => api.delete(`/messages/${peerId}`),
};

export const AI = {
  chat:            (messages, persona) => api.post('/ai/chat', { messages, persona }),
  hashtags:        caption => api.post('/ai/suggest-hashtags', { caption }),
  summarize:       messages => api.post('/ai/summarize', { messages }),
};

export const Telegram = {
  status:  () => api.get('/telegram/status'),
  send:    text => api.post('/telegram/send', { text }),
  unlink:  () => api.post('/telegram/unlink'),
};

export const Instagram = {
  authUrl:  () => api.get('/instagram/auth-url'),
  link:     (accessToken, igUserId) => api.post('/instagram/link', { accessToken, igUserId }),
  profile:  () => api.get('/instagram/profile'),
  media:    () => api.get('/instagram/media'),
  post:     (imageUrl, caption) => api.post('/instagram/post', { imageUrl, caption }),
  unlink:   () => api.post('/instagram/unlink'),
};

export const Upload = {
  file: formData => api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export default api;
