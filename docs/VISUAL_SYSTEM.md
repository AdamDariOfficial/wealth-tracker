# Visual System Baseline

**Status:** visual identity to preserve during the rebuild

## 1. Design intent

Nebula Wealth Hub should remain premium, futuristic, minimal and professional without becoming a generic trading terminal or a neon-heavy crypto interface.

The rebuild may change layout and component structure, but it must preserve recognizability.

## 2. Typography

- Display and headings: `Sora`.
- Body and interface: `Manrope`.
- Financial values, dates and technical labels: `JetBrains Mono` where useful.

Do not use monospace for long prose or primary navigation labels.

## 3. Core palette

The current implementation uses OKLCH tokens. Preserve the relationships:

- near-black neutral canvas;
- slightly lighter charcoal cards and popovers;
- cyan/electric-blue primary accent;
- soft green success values;
- soft red destructive or negative values;
- amber warnings;
- restrained violet as a secondary chart color.

Semantic colors must convey meaning consistently and must not be the only signal.

## 4. Surfaces and depth

Preserve:

- rounded cards;
- subtle translucent surfaces;
- restrained blur and borders;
- soft cyan glow only for focal elements;
- low-contrast grid or radial backgrounds where they improve depth.

Avoid:

- excessive glass blur;
- glow on every card;
- low-contrast text;
- animated background noise;
- decorative effects that reduce data legibility.

## 5. Mobile-first behavior

The primary design range is 320–430 px.

Required rules:

- no unintended horizontal overflow;
- at least 44 px interactive targets;
- safe-area handling at top and bottom;
- 16 px minimum form text on mobile to avoid iOS zoom;
- charts resize without clipped labels or inaccessible tooltips;
- wide tables become cards, lists or drill-down views;
- filters move into sheets or drawers;
- the primary create action is reachable with one hand;
- destructive confirmation remains explicit;
- important status cannot depend on hover.

## 6. Target navigation

Mobile primary navigation:

- Dashboard;
- Portfolio;
- Add;
- Calendar;
- More.

Desktop uses a restrained sidebar with the same information architecture. Do not maintain separate accounting engines merely to mirror legacy sidebar categories.

## 7. Motion

- Motion supports hierarchy and continuity, not decoration.
- Below-the-fold reveals begin as content enters the viewport.
- Route navigation starts at the top without smooth scrolling.
- Respect `prefers-reduced-motion` by disabling non-essential transforms and animated counters.
- Do not animate financial values in a way that delays comprehension.

## 8. Accessibility

- Visible focus on every interactive element.
- Keyboard access to menus, dialogs, tabs and sheets.
- `Escape` closes dismissible overlays and restores focus.
- Labels, descriptions and errors are programmatically associated.
- Contrast must be checked on glass surfaces, muted labels and chart legends.
- Positive/negative states include text, sign or icon in addition to color.

## 9. Visual regression checks

For each major feature, verify at least:

```text
320 × 568
375 × 812
390 × 844
430 × 932
768 × 1024
1024 × 768
1440 × 900
1600 × 1000
```

Check content order, navigation, chart labels, sheets, empty/error states, long values, keyboard focus and reduced motion.
