function getCurrentLocale(store) {
    const lang = store.get('settings.language', 'ru')

    const map = {
        ru: 'ru-RU',
        en: 'en-US',
        de: 'de-DE',
        es: 'es-ES',
        fr: 'fr-FR',
        it: 'it-IT',
        zh: 'zh-CN'
    }

    return map[lang] || 'ru-RU'
}

function getUserInitial(user) {
    return user?.name?.[0]?.toUpperCase() || '?'
}

function hashPassword(password) {
    let hash = 0
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return hash.toString(36) + password.length.toString(36)
}

module.exports = {
    getCurrentLocale,
    getUserInitial,
    hashPassword
}