'use strict'

const { session } = require('electron')
const store = require('./store')

let log
try { log = require('electron-log') } catch { log = console }

// Basic ad/tracker blocking list (simplified)
const AD_PATTERNS = [
    '*://*.doubleclick.net/*',
    '*://*.google-analytics.com/*',
    '*://*.googlesyndication.com/*',
    '*://*.googleadservices.com/*',
    '*://*.googletagservices.com/*',
    '*://*.googletagmanager.com/*',
    '*://*.ads.pubmatic.com/*',
    '*://*.ad-delivery.net/*',
    '*://*.adzerk.net/*',
    '*://*.adservice.google.com/*',
    '*://*.ads-twitter.com/*',
    '*://*.analytics.twitter.com/*',
    '*://*.ads.linkedin.com/*',
    '*://*.ads.youtube.com/*',
    '*://*.advertising.com/*',
    '*://*.adnxs.com/*',
    '*://*.carbonads.net/*',
    '*://*.openx.net/*',
    '*://*.scorecardresearch.com/*',
    '*://*.yandex.ru/ads/*',
    '*://*.an.yandex.ru/*',
    '*://*.mc.yandex.ru/*',
]

const AD_BLOCK_EXT_ID = 'centrio-builtin-adblock'

function isEnabled() {
    const installed = store.get('extensions.installed', [])
    const disabled  = store.get('extensions.disabled', [])
    return installed.includes(AD_BLOCK_EXT_ID) && !disabled.includes(AD_BLOCK_EXT_ID)
}

function applyToSession(sess) {
    if (!sess || !sess.webRequest) return

    if (!isEnabled()) {
        try { sess.webRequest.onBeforeRequest(null); } catch(e) {}
        return
    }

    sess.webRequest.onBeforeRequest({ urls: AD_PATTERNS }, (details, callback) => {
        log.info(`[adblock] Blocking: ${details.url}`)
        callback({ cancel: true })
    })
}

function updateAllSessions() {
    const enabled = isEnabled()
    const { session: electronSession } = require('electron')

    // Default session
    applyToSession(electronSession.defaultSession)

    // All messenger sessions
    const messengers = store.get('messengers', [])
    for (const m of messengers) {
        try {
            const sess = electronSession.fromPartition(`persist:${m.id}`)
            applyToSession(sess)
        } catch(e) {}
    }

    // Popup session
    try {
        const sess = electronSession.fromPartition('persist:ext-popup')
        applyToSession(sess)
    } catch(e) {}
}

module.exports = {
    AD_BLOCK_EXT_ID,
    isEnabled,
    applyToSession,
    updateAllSessions
}
