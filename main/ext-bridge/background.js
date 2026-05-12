// Centrio Popup Bridge — runs as chrome-extension://bridgeId/ origin.
//
// Primary strategy (ipc/window.js): find the target extension's own bg page
// and call window.open from there (same-extension → always allowed).
//
// This bridge is the FALLBACK for MV3 extensions (no background page).
// It opens the popup URL directly from bridge origin. The target extension's
// manifest is patched with extension_ids:[bridgeId] in WAR so Electron's
// ExtensionNavigationThrottle allows the cross-extension navigation.
//
// Returns Promise<{ok:bool, route:string, error?:string}>.
window._centrioOpenPopup = function(url, w, h) {
  return new Promise(function(resolve) {
    try {
      var features = 'width=' + (w || 400) + ',height=' + (h || 600);
      // Direct window.open to target URL.
      // Initiator: chrome-extension://bridgeId → throttle checks WAR of target.
      // Target manifest has extension_ids:[bridgeId,'*'] → PROCEED.
      // IMPORTANT: window.open returns null when setWindowOpenHandler uses
      // overrideBrowserWindowOptions (cross-context proxy is null by design).
      // The BrowserWindow IS created — main catches it via browser-window-created.
      try { window.open(url, '_blank', features); } catch (_) {}
      resolve({ ok: true, route: 'bridge-direct', url: url });
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
};

// Legacy — kept for compat (did-create-window about:blank path).
window._navigatePopup = function(popupWin, url) {
  try { popupWin.location.href = url; } catch (e) {}
};

// Cross-extension messaging relay — called via executeJavaScript from main.
window._centrioSendMessage = function(extId, msg) {
  return new Promise(function(resolve) {
    var settled = false;
    function done(r) { if (!settled) { settled = true; resolve(r); } }
    try {
      var t = setTimeout(function(){ done(undefined); }, 6000);
      chrome.runtime.sendMessage(extId, msg, function(response) {
        clearTimeout(t);
        var err = chrome.runtime.lastError;
        if (err) { done(undefined); return; }
        done(response);
      });
    } catch (e) { done(undefined); }
  });
};

// Cross-extension messaging relay. Called from main via executeJavaScript.
// Returns a Promise that resolves with the target extension's response, or
// undefined on timeout/no-response. Sending from extension origin via real
// chrome.runtime.sendMessage natively wakes dormant MV3 service workers.
window._centrioSendMessage = function(extId, msg) {
  return new Promise(function(resolve) {
    var settled = false;
    function done(r) { if (!settled) { settled = true; resolve(r); } }
    try {
      // 6s timeout — accommodates SW cold-start (~2s) + handler work.
      var t = setTimeout(function(){ done(undefined); }, 6000);
      chrome.runtime.sendMessage(extId, msg, function(response) {
        clearTimeout(t);
        // chrome.runtime.lastError fires when target has no listener / SW failed.
        var err = chrome.runtime.lastError;
        if (err) { done(undefined); return; }
        done(response);
      });
    } catch (e) { done(undefined); }
  });
};

// Wake an extension's MV3 service worker by hitting a no-op message. Even if
// it has no onMessage listener, the SW activates briefly so our subsequent
// real call (or the popup's own native chrome.runtime call) succeeds.
window._centrioWakeExt = function(extId) {
  try {
    chrome.runtime.sendMessage(extId, { __centrio_ping: 1 }, function(){
      void chrome.runtime.lastError; // suppress
    });
  } catch (e) {}
  return true;
};
