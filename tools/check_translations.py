"""Check the language structure of the site and every page in it.

Usage:  python -I tools/check_translations.py      (run from the repo root)

Checks the site root (home page) and every page directory (one that has
langs.js):
  - the default language is en, and every language (en included) lives in a
    subdirectory named by its code; the directory's own index.html is only a
    redirect (loads langs.js and shared/lang-redirect.js, falls back to en/)
  - langs.js lists exactly the language versions that exist
  - every relative href/src in every HTML file points to a file that exists,
    and each version loads shared/site.css, its langs.js and shared/site.js
    (page directories also ../app.js)
  - home-page versions link each page in their own language
  - <html lang> and <body data-lang> agree with the directory
  - compared with the default version: same counts of math delimiters and
    structural tags, same keys and {placeholders} in the
    <script id="strings"> JSON block
Exits with status 1 if anything is wrong.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CODES = ['en', 'tw', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'vi', 'id']
HTML_LANG = {'tw': 'zh-Hant'}
DEFAULT = 'en'
COUNTED = [r'\(', r'\)', r'\[', r'\]', '<p', '<li', '<b>', '<em>', '<blockquote',
           '<h1', '<h2', '<h3', '<table', '<button', '<input', '<canvas', '<script', '<link']
PLACEHOLDER = re.compile(r'\{(\w+)\}')
LINK = re.compile(r'\b(?:href|src)="([^"]*)"')
EXTERNAL = re.compile(r'^(?:[a-z]+:|//|#)')


def strings_block(html):
    m = re.search(r'<script id="strings" type="application/json">\s*(.*?)\s*</script>', html, re.S)
    return json.loads(m.group(1)) if m else None


def local_links(path, html):
    """Resolved targets of relative links in `path`, and those that do not exist."""
    targets, missing = set(), []
    for url in LINK.findall(html):
        if EXTERNAL.match(url):
            continue
        target = (path.parent / url.split('#')[0].split('?')[0]).resolve()
        if url.split('#')[0].endswith('/') or target.is_dir():
            target = target / 'index.html'
        targets.add(target)
        if not target.exists():
            missing.append(url)
    return targets, missing


def check_dir(page_dir, is_home):
    problems = []
    name = '(site root)' if is_home else page_dir.name
    langs_js = (page_dir / 'langs.js').read_text(encoding='utf-8')
    default = re.search(r"default:\s*'(\w+)'", langs_js).group(1)
    listed = re.findall(r"'(\w+)'", re.search(r'available:\s*\[(.*?)\]', langs_js).group(1))
    if default != DEFAULT:
        problems.append(f'langs.js default is {default!r}, expected {DEFAULT!r}')

    redirect = page_dir / 'index.html'
    if not redirect.exists():
        problems.append(f'{name}: index.html (redirect) is missing')
    else:
        html = redirect.read_text(encoding='utf-8')
        targets, missing = local_links(redirect, html)
        problems += [f'{name}/index.html: broken link {u}' for u in missing]
        if f'url={default}/' not in html:
            problems.append(f'{name}/index.html: no fallback redirect to {default}/')
        for need in (page_dir / 'langs.js', ROOT / 'shared' / 'lang-redirect.js'):
            if need.resolve() not in targets:
                problems.append(f'{name}/index.html: does not load {need.relative_to(ROOT)}')
    if not is_home and not (page_dir / 'app.js').exists():
        problems.append(f'{name}/app.js is missing')

    versions = {sub.name: sub / 'index.html' for sub in sorted(page_dir.iterdir())
                if sub.is_dir() and (sub / 'index.html').exists() and (not is_home or sub.name in CODES)}
    if default not in versions:
        problems.append(f'default version {default}/index.html is missing')
        return versions, problems
    if sorted(listed) != sorted(versions):
        problems.append(f'langs.js lists {sorted(listed)} but versions on disk are {sorted(versions)}')

    required = [ROOT / 'shared' / 'site.css', page_dir / 'langs.js', ROOT / 'shared' / 'site.js']
    if not is_home:
        required.append(page_dir / 'app.js')
    base = versions[default].read_text(encoding='utf-8')
    base_counts = {t: base.count(t) for t in COUNTED}
    base_strings = strings_block(base)

    for code, path in versions.items():
        html = path.read_text(encoding='utf-8')
        where = path.relative_to(ROOT)
        want_lang = HTML_LANG.get(code, code)
        if f'<html lang="{want_lang}">' not in html:
            problems.append(f'{where}: <html lang> should be "{want_lang}"')
        if not re.search(rf'<body[^>]* data-lang="{code}"', html):
            problems.append(f'{where}: <body data-lang> should be "{code}"')
        targets, missing = local_links(path, html)
        problems += [f'{where}: broken link {u}' for u in missing]
        for need in required:
            if need.resolve() not in targets:
                problems.append(f'{where}: does not load {need.relative_to(ROOT)}')
        if is_home:
            for url in re.findall(r'class="card" href="([^"]*)"', html):
                if not url.endswith(f'/{code}/'):
                    problems.append(f'{where}: card {url} is not the {code} version')
        for tag, n in base_counts.items():
            if html.count(tag) != n:
                problems.append(f'{where}: {tag!r} appears {html.count(tag)}×, default has {n}×')
        strings = strings_block(html)
        if base_strings is not None:
            if strings is None:
                problems.append(f'{where}: strings block missing or not valid JSON')
                continue
            if set(strings) != set(base_strings):
                problems.append(f'{where}: strings keys differ: {sorted(set(strings) ^ set(base_strings))}')
            for key in set(strings) & set(base_strings):
                a = sorted(set(PLACEHOLDER.findall(base_strings[key])))
                b = sorted(set(PLACEHOLDER.findall(strings[key])))
                if a != b:
                    problems.append(f'{where}: placeholders in "{key}" are {b}, expected {a}')
    return versions, problems


def main():
    failed = False
    dirs = [(ROOT, True)] + [(p.parent, False) for p in sorted(ROOT.glob('*/langs.js'))]
    for page_dir, is_home in dirs:
        versions, problems = check_dir(page_dir, is_home)
        label = 'home page' if is_home else page_dir.name
        status = 'OK' if not problems else f'{len(problems)} problem(s)'
        print(f'{label}: {len(versions)} languages ({", ".join(versions)}): {status}')
        for p in problems:
            print('   ', p)
        failed |= bool(problems)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
