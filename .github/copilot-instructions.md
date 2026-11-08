# Repository instructions

Follow the repository-wide AI rules in [`../AGENTS.md`](../AGENTS.md). In particular, `shared/site.css` is the only place for first-party website styles: new and existing pages must use it, reuse its design tokens, and must not add local stylesheets, `<style>` blocks, or inline style attributes. Keep page-specific layout rules in clearly labeled sections of the shared stylesheet so the pages share one visual system without losing necessary interaction-specific layouts.
