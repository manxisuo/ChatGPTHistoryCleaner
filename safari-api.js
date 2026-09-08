// Safari Web Extensions may expose either `browser` or `chrome`.
// The extension code uses `chrome.*`, so keep one stable namespace.
(function () {
  if (typeof globalThis.chrome === 'undefined' && typeof globalThis.browser !== 'undefined') {
    globalThis.chrome = globalThis.browser;
  }
})();
