// Terms / Privacy pages: follow the system theme and highlight the section being read
(function () {
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var apply = function () {
    document.documentElement.setAttribute('data-theme', mq && !mq.matches ? 'light' : 'dark');
  };
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);

  document.addEventListener('DOMContentLoaded', function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('.pc-toc a'));
    var sections = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
    if (!links.length || !('IntersectionObserver' in window)) return;
    var setActive = function (id) {
      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        // keep the active chip in view on the mobile row
        if (on && a.parentElement.parentElement.scrollWidth > a.parentElement.parentElement.clientWidth) {
          var row = a.parentElement.parentElement;
          row.scrollTo({ left: a.offsetLeft - row.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
        }
      });
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-25% 0px -65% 0px' });
    sections.forEach(function (s) { io.observe(s); });
    setActive(sections[0].id);
  });
})();
