// Shared page chrome for every interactive page:
//   - top bar with a home link and a language menu  (fills <nav id="topbar">)
//   - AI-translation notice                         (fills <div id="ai-notice">)
//
// Each page directory provides langs.js, which sets
//   window.PAGE_LANGS = { default: 'zh', available: ['zh', 'en', ...] };
// The default language lives at the page directory itself; every other
// language lives in a subdirectory named by its code (e.g. ja/).
// Each HTML file declares its own language with <body data-lang="ja">, and
// adds data-ai-translated when the version has not been reviewed by the author.
(() => {
  // Menu order and native names
  const LANGS = [
    ['zh', '繁體中文'],
    ['en', 'English'],
    ['ja', '日本語'],
    ['ko', '한국어'],
    ['fr', 'Français'],
    ['de', 'Deutsch'],
    ['es', 'Español'],
    ['pt', 'Português'],
    ['vi', 'Tiếng Việt'],
    ['id', 'Bahasa Indonesia'],
  ];

  // Accessible name and tooltip of the home icon
  const HOME = {
    zh: '首頁', en: 'Home', ja: 'ホーム', ko: '홈', fr: 'Accueil',
    de: 'Startseite', es: 'Inicio', pt: 'Início', vi: 'Trang chủ', id: 'Beranda',
  };

  const ICON_HOME = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>';
  const ICON_GLOBE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';

  const MENU_LABEL = {
    zh: '語言', en: 'Language', ja: '言語', ko: '언어', fr: 'Langue',
    de: 'Sprache', es: 'Idioma', pt: 'Idioma', vi: 'Ngôn ngữ', id: 'Bahasa',
  };

  // {orig} → link to the original-language version, {contact} → link to the contact section
  const NOTICE = {
    zh: '本頁由 AI 從<a href="{orig}">原文</a>翻譯而成，如有錯誤，敬請<a href="{contact}">來信指正</a>。',
    en: 'This page was translated by AI from the <a href="{orig}">original</a>. If you spot an error, please <a href="{contact}">let us know</a>.',
    ja: 'このページは<a href="{orig}">原文</a>から AI によって翻訳されました。誤りにお気づきの場合は<a href="{contact}">ご連絡ください</a>。',
    ko: '이 페이지는 <a href="{orig}">원문</a>을 AI가 번역한 것입니다. 오류를 발견하시면 <a href="{contact}">알려 주세요</a>.',
    fr: 'Cette page a été traduite par IA à partir de l’<a href="{orig}">original</a>. Si vous repérez une erreur, merci de <a href="{contact}">nous la signaler</a>.',
    de: 'Diese Seite wurde von einer KI aus dem <a href="{orig}">Original</a> übersetzt. Wenn Sie einen Fehler finden, <a href="{contact}">teilen Sie ihn uns bitte mit</a>.',
    es: 'Esta página fue traducida por IA a partir del <a href="{orig}">original</a>. Si encuentra un error, <a href="{contact}">avísenos</a>, por favor.',
    pt: 'Esta página foi traduzida por IA a partir do <a href="{orig}">original</a>. Se encontrar algum erro, por favor <a href="{contact}">avise-nos</a>.',
    vi: 'Trang này được AI dịch từ <a href="{orig}">bản gốc</a>. Nếu bạn phát hiện lỗi, xin vui lòng <a href="{contact}">báo cho chúng tôi</a>.',
    id: 'Halaman ini diterjemahkan oleh AI dari <a href="{orig}">versi aslinya</a>. Jika Anda menemukan kesalahan, mohon <a href="{contact}">beri tahu kami</a>.',
  };

  const page = window.PAGE_LANGS || { default: 'en', available: ['en'] };
  const lang = document.body.dataset.lang || page.default;
  const pageRoot = lang === page.default ? './' : '../';
  const siteRoot = pageRoot + '../';
  const urlFor = code => pageRoot + (code === page.default ? '' : code + '/');

  const bar = document.getElementById('topbar');
  if (bar) {
    const home = document.createElement('a');
    home.className = 'site-home';
    home.href = siteRoot;
    home.innerHTML = ICON_HOME;
    home.title = HOME[lang] || HOME.en;
    home.setAttribute('aria-label', home.title);

    const menu = document.createElement('select');
    menu.className = 'lang-menu';
    menu.setAttribute('aria-label', MENU_LABEL[lang] || MENU_LABEL.en);
    for (const [code, name] of LANGS) {
      if (!page.available.includes(code)) continue;
      const opt = new Option(name, code, false, code === lang);
      opt.lang = code === 'zh' ? 'zh-Hant' : code;
      menu.add(opt);
    }
    menu.addEventListener('change', () => { location.href = urlFor(menu.value); });

    const picker = document.createElement('label');
    picker.className = 'lang-picker';
    picker.innerHTML = ICON_GLOBE;
    picker.append(menu);

    bar.replaceChildren(home, picker);
  }

  const box = document.getElementById('ai-notice');
  if (box && document.body.hasAttribute('data-ai-translated')) {
    box.className = 'ai-notice';
    box.innerHTML = (NOTICE[lang] || NOTICE.en)
      .replace('{orig}', urlFor(page.default))
      .replace('{contact}', siteRoot + '#contact');
  }
})();
