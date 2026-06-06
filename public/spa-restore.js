// Restore the original URL after a spa-github-pages 404 redirect.
// Must run synchronously before React loads — loaded as a plain <script> in index.html.
(function () {
  var l = window.location;
  if (l.search[1] !== '/') return;
  var decoded = l.search.slice(1).split('&').map(function (s) {
    return s.replace(/~and~/g, '&');
  });
  window.history.replaceState(
    null, null,
    l.pathname.slice(0, -1) + decoded[0] +
    (decoded[1] ? '?' + decoded[1] : '') +
    l.hash
  );
}());
