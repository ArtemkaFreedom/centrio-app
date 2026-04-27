const store = require('./store')

const dictionaries = {
    ru: require('../../locales/ru'),
    en: require('../../locales/en'),
    de: require('../../locales/de'),
    es: require('../../locales/es'),
    fr: require('../../locales/fr'),
    it: require('../../locales/it'),
    zh: require('../../locales/zh')
}

function getCurrentLanguage() {
    return store.get('settings.language', 'ru')
}

function getDictionary(lang = getCurrentLanguage()) {
    return dictionaries[lang] || dictionaries.ru
}

function getByPath(obj, path) {
    return path.split('.').reduce((acc, key) => {
        if (acc && typeof acc === 'object' && key in acc) {
            return acc[key]
        }
        return undefined
    }, obj)
}

function interpolate(text, params = {}) {
    if (typeof text !== 'string') return text

    return text.replace(/\{(\w+)\}/g, (_, key) => {
        return key in params ? String(params[key]) : `{${key}}`
    })
}

function t(path, fallbackOrParams = path, maybeParams = {}) {
    const dict = getDictionary()
    const value = getByPath(dict, path)

    const fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : path
    const params = typeof fallbackOrParams === 'object' && fallbackOrParams !== null
        ? fallbackOrParams
        : maybeParams

    if (typeof value === 'undefined') {
        return interpolate(fallback, params)
    }

    return interpolate(value, params)
}

module.exports = {
    t,
    getCurrentLanguage,
    getDictionary
}