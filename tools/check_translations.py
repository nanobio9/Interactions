"""Check that every language version of every page matches its default version.

Usage:  python -I tools/check_translations.py      (run from the repo root)

For each page directory (one that has langs.js), compares every language
version with the default-language index.html:
  - same counts of math delimiters and structural tags
  - same keys and {placeholders} in the <script id="strings"> JSON block
  - <html lang> and <body data-lang> agree with the directory
  - langs.js lists exactly the language versions that exist
Exits with status 1 if anything is wrong.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_LANG = {'zh': 'zh-Hant'}
COUNTED = [r'\(', r'\)', r'\[', r'\]', '<p', '<li', '<b>', '<em>', '<blockquote',
           '<h1', '<h2', '<h3', '<table', '<button', '<input', '<canvas', '<script', '<link']
PLACEHOLDER = re.compile(r'\{(\w+)\}')


def strings_block(html):
    m = re.search(r'<script id="strings" type="application/json">\s*(.*?)\s*</script>', html, re.S)
    return json.loads(m.group(1)) if m else None


def check_page(page_dir):
    problems = []
    langs_js = (page_dir / 'langs.js').read_text(encoding='utf-8')
    default = re.search(r"default:\s*'(\w+)'", langs_js).group(1)
    listed = re.findall(r"'(\w+)'", re.search(r'available:\s*\[(.*?)\]', langs_js).group(1))

    versions = {default: page_dir / 'index.html'}
    for sub in sorted(page_dir.iterdir()):
        if sub.is_dir() and (sub / 'index.html').exists():
            versions[sub.name] = sub / 'index.html'

    if sorted(listed) != sorted(versions):
        problems.append(f'langs.js lists {sorted(listed)} but versions on disk are {sorted(versions)}')

    base = versions[default].read_text(encoding='utf-8')
    base_counts = {t: base.count(t) for t in COUNTED}
    base_strings = strings_block(base)

    for code, path in versions.items():
        html = path.read_text(encoding='utf-8')
        where = path.relative_to(ROOT)
        want_lang = HTML_LANG.get(code, code)
        if f'<html lang="{want_lang}">' not in html:
            problems.append(f'{where}: <html lang> should be "{want_lang}"')
        if not re.search(rf'<body data-lang="{code}"', html):
            problems.append(f'{where}: <body data-lang> should be "{code}"')
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
    for langs_js in sorted(ROOT.glob('*/langs.js')):
        versions, problems = check_page(langs_js.parent)
        status = 'OK' if not problems else f'{len(problems)} problem(s)'
        print(f'{langs_js.parent.name}: {len(versions)} languages ({", ".join(versions)}): {status}')
        for p in problems:
            print('   ', p)
        failed |= bool(problems)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
