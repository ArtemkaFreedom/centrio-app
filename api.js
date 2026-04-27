const https = require('https')
const http = require('http')
const { API_URL } = require('./main/config/constants')

function createHttpError(status, data) {
    const message =
        data?.error ||
        data?.message ||
        `HTTP ${status}`

    const error = new Error(message)
    error.response = {
        status,
        data
    }

    return error
}

function parseResponseBody(raw) {
    if (!raw || !raw.trim()) return null

    try {
        return JSON.parse(raw)
    } catch {
        return raw
    }
}

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_URL + path)
        const isHttps = url.protocol === 'https:'
        const payload = body ? JSON.stringify(body) : null

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        }

        if (token) {
            options.headers.Authorization = `Bearer ${token}`
        }

        if (payload) {
            options.headers['Content-Length'] = Buffer.byteLength(payload)
        }

        const transport = isHttps ? https : http
        const req = transport.request(options, (res) => {
            let raw = ''

            res.on('data', (chunk) => {
                raw += chunk
            })

            res.on('end', () => {
                const data = parseResponseBody(raw)
                const response = {
                    status: res.statusCode,
                    data
                }

                if (res.statusCode >= 400) {
                    reject(createHttpError(res.statusCode, data))
                    return
                }

                resolve(response)
            })
        })

        req.on('error', reject)

        if (payload) {
            req.write(payload)
        }

        req.end()
    })
}

module.exports = {
    register(email, password, name) {
        return request('POST', '/api/auth/register', { email, password, name })
    },

    login(email, password) {
        return request('POST', '/api/auth/login', { email, password })
    },

    me(token) {
        return request('GET', '/api/auth/me', null, token)
    },

    refresh(refreshToken) {
        return request('POST', '/api/auth/refresh', { refreshToken })
    },

    logout(token) {
        return request('POST', '/api/auth/logout', null, token)
    },

    googleDesktop(idToken, token) {
        return request('POST', '/api/auth/google/desktop', { idToken }, token)
    },

    yandexDesktop(accessToken) {
        return request('POST', '/api/auth/yandex/desktop', { accessToken })
    },

    vkDesktop(accessToken, userId) {
        return request('POST', '/api/auth/vk/desktop', { accessToken, userId })
    },

    syncPush(token, messengers, folders, settings) {
        return request(
            'POST',
            '/api/sync',
            { messengers, folders, settings },
            token
        )
    },

    syncPull(token) {
        return request('GET', '/api/sync', null, token)
    },

    updateProfile(token, data) {
        return request('PUT', '/api/user/profile', data, token)
    },

    trackStats(token, data) {
        return request('POST', '/api/stats/track', data, token)
    },

    getStats(token) {
        return request('GET', '/api/stats/summary', null, token)
    },

    getDevices(token) {
        return request('GET', '/api/user/devices', null, token)
    },

    revokeDevice(token, deviceId) {
        return request('DELETE', `/api/user/devices/${deviceId}`, null, token)
    },

    getNotifications(token) {
        return request('GET', '/api/notifications', null, token)
    },

    readAllNotifications(token) {
        return request('POST', '/api/notifications/read-all', {}, token)
    }
}