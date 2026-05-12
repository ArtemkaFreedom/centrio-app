// Centrio Popup Relay — loaded as a regular BrowserWindow (not backgroundPage)
// in persist:ext-popup at chrome-extension://bridgeId/ origin.
//
// Unlike backgroundPage WebContents, a regular window's window.open() correctly
// inherits the opener's session (persist:ext-popup), so the new popup window
// also lands in persist:ext-popup where all extensions are loaded.
//
// The navigation is renderer-initiated from chrome-extension://bridgeId/ →
// ExtensionNavigationThrottle checks the target extension's WAR
// extension_ids:[bridgeId] → PROCEED.
window._centrioRelayOpen = function(url, w, h) {
  try {
    var features = 'width=' + (w || 400) + ',height=' + (h || 600);
    window.open(url, '_blank', features);
    return { ok: true, route: 'relay-open' };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
};
