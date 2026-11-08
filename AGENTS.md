# AI Instructions for Interactions

## Shared website style

- Treat `shared/site.css` as the single authoritative stylesheet for the entire repository. Read it before creating or changing page styles.
- Every HTML page must load `shared/site.css` using the correct relative path. Do not add page-local stylesheets, `<style>` blocks, or inline `style` attributes.
- Add any new shared or page-specific CSS rules to `shared/site.css`, grouped under a clearly named section. Page-specific layout rules are allowed there when an interactive page needs them; keep the site's shared typography, controls, navigation, spacing, surfaces, and responsive behavior consistent.
- Reuse the existing CSS custom properties for colors, typography, surfaces, borders, charts, and status states. Do not introduce new hard-coded colors when an existing token fits. Add a new token to `:root` only when a genuine new role needs one.
- Preserve the established dark-green theme, system/CJK font stacks, 8px-or-less corner radii, visible keyboard focus, and mobile responsive behavior unless the user explicitly requests a design change.
- Keep third-party stylesheets, such as KaTeX's vendor CSS, external when required; do not copy vendor CSS into `shared/site.css`.

## Before finishing a web change

- Check that every affected HTML page references the shared stylesheet with a valid relative URL, including translated pages.
- Check for new `<style>` blocks, inline `style` attributes, or local `style.css` links; do not leave first-party styling outside `shared/site.css`.
- Preview affected pages locally and verify desktop and narrow/mobile layout when the environment permits.
- Do not commit or push unless the user asks.
