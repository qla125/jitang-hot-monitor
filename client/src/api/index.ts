import axios from 'axios'
import type { Alert, HotTopic, Keyword, Settings } from '../types'

const api = axios.create({ baseURL: '/api' })

export const keywordsApi = {
  getAll: () => api.get<Keyword[]>('/keywords'),
  create: (data: { keyword: string; description?: string }) =>
    api.post<Keyword>('/keywords', data),
  update: (id: number, data: Partial<Omit<Keyword, 'expanded_terms'>> & { expanded_terms?: string[] }) =>
    api.put<Keyword>(`/keywords/${id}`, data),
  remove: (id: number) => api.delete(`/keywords/${id}`),
  // 重新生成扩展词（AI 批量改写关键词的同义/别名说法，用于扩大检索召回范围）
  regenerateExpansion: (id: number) => api.post<Keyword>(`/keywords/${id}/expand`),
}

export const topicsApi = {
  getAll: (hours = 720) =>
    api.get<HotTopic[]>('/hot-topics', { params: { hours } }),
  refresh: () => api.post('/hot-topics/refresh'),
  searchKeywords: () => api.post<{ message: string; keywords: string[] }>('/hot-topics/search-keywords'),
}

export const alertsApi = {
  getAll: () =>
    api.get<{ alerts: Alert[]; unreadCount: number }>('/alerts'),
  markRead: (id: number) => api.put(`/alerts/${id}/read`),
  markAllRead: () => api.put('/alerts/read-all'),
}

export const settingsApi = {
  get: () => api.get<Settings>('/settings'),
  save: (data: Partial<Settings>) => api.put('/settings', data),
}
