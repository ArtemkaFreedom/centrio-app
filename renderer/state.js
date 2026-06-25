const state = {
    activeMessengers: [],
    folders: [],
    activeTabId: null,
    unreadCounts: {},
    rawUnreadCounts: {},
    mutedMessengers: {},
    globalMuteAll: false,
    contextTargetId: null,
    contextTargetFolderId: null,
    editMode: null,
    selectedFolderIcon: 'folder',
    soundTargetId: null,
    activeFolderPanelId: null,
    dragSrcId: null,
    dragSrcType: null,
    modalPage: 0,
    modalFiltered: [],
    menuCollapsed: false,
    appZoomLevel: 0,
    tabZoomLevel: 1.0,
    wvContextParams: {},
    changeIconTargetId: null,
    changeIconNewSrc: null,
    tooltipTimeout: null,
    pinNewVal: '',
    pinConfirmVal: '',
    pinActive: null,
    disableVal: '',
    messengerNotifyState: {},
    webviewWatchBound: new Set(),
    siteNotificationState: {},
    unreadStabilizeTimers: {},
    // ── Split-screen ──────────────────────────────────────────────────────────
    splitMode:    false,   // is split mode active?
    splitTabId:   null,    // ID of the secondary (right pane) messenger
    splitFocus:   'left',  // 'left' | 'right' — which pane receives tab switches
    splitLeftPct: 50       // divider position 20–80 %
}

module.exports = state