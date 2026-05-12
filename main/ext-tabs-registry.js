/**
 * ext-tabs-registry.js
 *
 * In-memory store that maps Centrio messenger IDs → Chrome-compatible tab
 * objects.  The extension API session preload reads this via IPC to answer
 * chrome.tabs.query() calls that would otherwise return an empty array
 * (because Electron popup BrowserWindows are not "real" Chrome tabs).
 */

'use strict'

let tabCounter = 100          // start above 0 so extensions don't think ID=0
const tabMap   = new Map()    // messengerId (string) → tab object
let activeMsgId = null        // currently focused messenger id

/**
 * Register a messenger webview as a Chrome tab.
 * Safe to call multiple times — subsequent calls only update url/title.
 */
function registerTab(messengerId, partition, url, title) {
    if (!tabMap.has(messengerId)) {
        const id = tabCounter++
        tabMap.set(messengerId, {
            id,
            messengerId,
            partition:   partition || '',
            url:         url       || '',
            title:       title     || url || '',
            active:      false,
            highlighted: false,
            pinned:      false,
            incognito:   false,
            status:      'complete',
            windowId:    1,
            index:       tabMap.size
        })
    } else {
        const tab = tabMap.get(messengerId)
        if (url   !== undefined && url   !== null) tab.url   = url
        if (title !== undefined && title !== null) tab.title = title || url || tab.title
    }
    return tabMap.get(messengerId)
}

/** Mark a tab as active (and all others as inactive). */
function activateTab(messengerId) {
    activeMsgId = messengerId
    for (const [id, tab] of tabMap.entries()) {
        tab.active      = (id === messengerId)
        tab.highlighted = (id === messengerId)
    }
}

/** Update url / title / status for a tab. */
function updateTab(messengerId, info) {
    const tab = tabMap.get(messengerId)
    if (!tab) return
    if (info.url    !== undefined) tab.url    = info.url
    if (info.title  !== undefined) tab.title  = info.title || info.url || tab.title
    if (info.status !== undefined) tab.status = info.status
}

/** Remove a messenger's tab entry (called when messenger is removed). */
function unregisterTab(messengerId) {
    tabMap.delete(messengerId)
    if (activeMsgId === messengerId) activeMsgId = null
}

/** Return all registered tabs as plain objects (safe to serialize over IPC). */
function getTabs() {
    return Array.from(tabMap.values()).map(t => ({ ...t }))
}

/** Return the currently active tab, or null. */
function getActiveTab() {
    if (!activeMsgId) {
        // Fallback: find any tab marked active
        for (const tab of tabMap.values()) {
            if (tab.active) return { ...tab }
        }
        return null
    }
    const tab = tabMap.get(activeMsgId)
    return tab ? { ...tab } : null
}

module.exports = {
    registerTab,
    activateTab,
    updateTab,
    unregisterTab,
    getTabs,
    getActiveTab
}
