import { apiRequest, getAuthSession } from './client.js'

function clampInt(value, fallback, max) {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback
}

export function normalizeNotificationPage(value) {
  const items = Array.isArray(value?.items) ? value.items : []
  return {
    items: items.map((item) => ({
      id: item.notification_id,
      title: item.title ?? '',
      description: item.description ?? '',
      type: item.type_code ?? 'INFO',
      priority: Number(item.display_priority) || 0,
      createdAt: item.created_at ?? null,
      isRead: Boolean(item.is_read),
    })),
    page: Number(value?.page) || 1,
    pageSize: Number(value?.page_size) || items.length,
    totalItems: Number(value?.total_items) || items.length,
    totalPages: Number(value?.total_pages) || 1,
  }
}

export const notificationApi = {
  async list({ page = 1, pageSize = 20 } = {}) {
    const query = new URLSearchParams({
      page: String(clampInt(page, 1, Number.MAX_SAFE_INTEGER)),
      page_size: String(clampInt(pageSize, 20, 100)),
    })
    const signedIn = Boolean(getAuthSession()?.accessToken)
    // Token là tuỳ chọn: có token thì có thêm thông báo riêng và trạng thái đã đọc.
    const value = await apiRequest(`/notification?${query}`, { auth: signedIn })
    return normalizeNotificationPage(value)
  },
  detail: (id) => apiRequest(`/notification/${encodeURIComponent(String(id))}`),
  readAll: () => apiRequest('/notification/read-all', { method: 'POST' }),
}
