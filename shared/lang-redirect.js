// Forwards a page directory (or the site root) to a language subdirectory:
// the language the visitor last picked from the menu (saved by site.js),
// if this directory has it; otherwise the default from langs.js.
(() => {
  const LANG_KEY = 'interactions-lang';   // must match site.js
  const page = window.PAGE_LANGS || { default: 'en', available: ['en'] };
  let lang = null;
  try { lang = localStorage.getItem(LANG_KEY); } catch (e) { /* storage blocked */ }
  if (!page.available.includes(lang)) lang = page.default;
  location.replace(lang + '/' + location.search + location.hash);
})();
