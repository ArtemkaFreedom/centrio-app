// Runs inside chrome-extension://bridgeId/wrapper.html — a real extension frame.
// Instead of an iframe (subframe throttle blocks cross-extension), we navigate
// THIS window (top-level, renderer-initiated from extension context) to the
// target URL. The throttle checks WAR for renderer-initiated top-level extension
// → extension navigation; target manifests are patched with extension_ids:['*'].
(function () {
  var hash = location.hash || '';
  var url = '';
  try { url = decodeURIComponent(hash.replace(/^#/, '')); } catch (e) {}
  if (!url || !url.startsWith('chrome-extension://')) return;
  // Top-level navigation from bridge extension frame to target extension.
  window.location.replace(url);
})();
