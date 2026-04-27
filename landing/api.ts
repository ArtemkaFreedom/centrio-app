import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ── Token helpers ──────────────────────────────────────────────────────────
// Zustand persist сохраняет под ключом 'centrio-auth' как {"state":{...},"version":0}
// Interceptor должен читать именно оттуда, а НЕ из прямых ключей localStorage

function getFromStore(key: 'accessToken' | 'refreshToken'): string | null {
  if (typeof window === 'undefined') return null
  try {
    // Читаем из Zustand persist (centrio-auth) — основной источник
    const raw = localStorage.getItem('centrio-auth')
    if (raw) {
      const parsed = JSON.parse(raw)
      const val = parsed?.state?.[key]
      if (val) return val
    }
  } catch {}
  // Fallback: прямые ключи (OAuth success page ставит их временно)
  return localStorage.getItem(key)
}

function clearStore() {
  if (typeof window === 'undefined') return
  // Прямые ключи (OAuth fallback)
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  // Zustand persist
  try {
    const raw = localStorage.getItem('centrio-auth')
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed?.state) {
      parsed.state.accessToken = null
      parsed.state.refreshToken = null
      parsed.state.user = null
      localStorage.setItem('centrio-auth', JSON.stringify(parsed))
    }
  } catch {}
}

function updateStoreToken(newAccessToken: string) {
  if (typeof window === 'undefined') return
  // Обновляем оба места
  localStorage.setItem('accessToken', newAccessToken)
  try {
    const raw = localStorage.getItem('centrio-auth')
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed?.state) {
      parsed.state.accessToken = newAccessToken
      localStorage.setItem('centrio-auth', JSON.stringify(parsed))
    }
  } catch {}
}

// ── Axios instance ─────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = getFromStore('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Refresh-lock: один refresh на всех ────────────────────────────────────
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

function enqueueRefresh(cb: (token: string) => void) {
  refreshQueue.push(cb)
}

function flushQueue(token: string) {
  refreshQueue.forEach(cb => cb(token))
  refreshQueue = []
}

function abortQueue() {
  refreshQueue = []
}

// Обновляем токен если истёк, не перезагружаем страницу бесконечно
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    // Если refresh уже идёт — ставим в очередь
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        enqueueRefresh((newToken: string) => {
          original.headers.Authorization = `Bearer ${newToken}`
          resolve(api(original))
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const refreshToken = getFromStore('refreshToken')
      if (!refreshToken) throw new Error('no_refresh_token')

      const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken })
      const newToken: string = data.accessToken

      // Обновляем только Zustand-стор (не прямые ключи)
      updateStoreToken(newToken)
      isRefreshing = false
      flushQueue(newToken)

      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch {
      isRefreshing = false
      abortQueue()

      // Очищаем стор полностью чтобы Zustand тоже видел logout
      clearStore()

      // Небольшая задержка чтобы дать Zustand прочитать обновлённый стор
      // перед редиректом (иначе dashboard снова думает что мы залогинены)
      setTimeout(() => {
        window.location.href = '/auth/login'
      }, 100)

      return Promise.reject(error)
    }
  }
)
