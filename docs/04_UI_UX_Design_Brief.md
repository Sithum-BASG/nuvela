# UI/UX Design Brief — Nuvela

**Document 4 of 6 — Planning Suite**
**Project:** INTE 21323 — Task Management System
**Status:** Locked baseline for the high-fidelity design and build

---

## Purpose

This brief locks Nuvela's visual language so that every screen — whether generated, designed in Figma, or built in code — draws from one source of truth and reads as a single, intentionally designed product. It is written to be concrete enough to act as a build spec: real token values, a defined spacing and type scale, and per-component rules. The neutral-plus-one-accent system and the light/dark token approach are what make consistency automatic rather than hand-maintained.

A guiding principle runs through everything below: **calm comes from restraint.** The palette is ~90% neutral and ~10% accent; whitespace is generous; the accent appears only where it earns attention. The same colors crammed into a dense, over-decorated layout would lose the premium feel entirely — so the discipline (scarce accent, generous space, limited type scale) is as important as the values themselves.

## Overall Aesthetic

Calm, minimal, and quietly premium. Spacious rather than dense; understated rather than colorful. The reference feel is **Linear** above all (restraint, subtle borders, one purposeful accent, generous spacing), with **Height**, **Things**, and **Notion** as supporting references for calm, content-forward productivity UI. Hierarchy is created through space and weight, not through loud color or heavy dividers. The product should feel like a focused workspace, not a busy dashboard.

**Reference apps:** Linear (primary), Height, Things, Notion, Vercel (for restraint and typography).

## Color Palette

The system is a neutral canvas with a single Soft Indigo accent. Every color is defined as a semantic token with a light and dark value, so theming is a token swap, not a per-screen redesign. **Implementation note:** define these as CSS variables / Tailwind theme tokens (and Figma variables) — never hard-code hex values in components.

### Accent — Soft Indigo (the brand color)

A five-stop ramp. Soft indigo was chosen for being calm, distinctive, and premium, while being deep enough that the base passes contrast for white text (unlike lighter pastels).

| Token | Hex | Use |
|---|---|---|
| `accent-tint` | `#EDEBFB` | Light backgrounds, chips, hover wash, selected-row tint |
| `accent` (base) | `#7C74D6` | Primary buttons, active states, fills, avatars, focus ring |
| `accent-strong` | `#5A52B5` | Accent text and links on light backgrounds (contrast-safe) |
| `accent-dark-mode` | `#8B83E0` | The accent fill in dark mode (brightened so it holds presence) |
| `accent-bright` | `#A79FEA` | Accent text and links in dark mode |

Usage rules: the accent is scarce. It marks the *one* primary action per view, active navigation, focus states, and selection. Secondary actions are neutral (outlined or ghost). Never fill large areas with the accent.

### Neutrals

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` (app canvas) | `#F8F9FB` | `#16181D` | The neutral page background |
| `surface` (cards) | `#FFFFFF` | `#1D2027` | Cards, panels, inputs, raised surfaces |
| `border` | `#E4E6EA` | `#2A2D34` | Subtle borders and dividers (preferred over shadows) |
| `text-primary` | `#0A1422` | `#EDEDEB` | Headings and primary text |
| `text-secondary` | `#5F5E5A` | `#B4B2A9` | Body, labels, metadata |
| `text-muted` | `#8C8B85` | `#888780` | Placeholders, timestamps, hints |

### Semantic colors

Muted to fit the calm palette — not bright traffic-light primaries. Each needs a light tint (for backgrounds) and a base (for text/icons).

| Token | Hex (base) | Use |
|---|---|---|
| `success` | `#2F855A` | Completed, positive confirmations |
| `warning` | `#B7791F` | Approaching deadline, caution |
| `danger` | `#C53030` | Destructive actions, errors, overdue |
| `info` | `#7C74D6` | Informational (reuses the accent) |

Priority indicators (Low/Medium/High) and task labels use muted tints from this same family, never saturated primaries. **Note:** `danger` (red) is kept clearly distinct from the indigo accent so the UI's "destructive" signal never reads as "primary action."

## Typography

A two-font system with a clear role split: **Sora** carries brand voice and hierarchy (seen large, used sparingly); **Roboto** carries function and legibility (seen everywhere, must stay readable at small sizes and in dense layouts). Both are free Google Fonts, loaded in Next.js via `next/font/google`.

**Sora — display font.** The logo wordmark, page titles, section headings, and large landing/marketing type. Geometric and modern without being trendy. Weights: 600 (headings, wordmark), 500 (lighter headings).

**Roboto — UI / body font.** Body text, task titles, form labels, inputs, table content, buttons, metadata, captions — all dense, functional text. A neutral, highly legible workhorse. Weights: 400 (body), 500 (emphasis/labels), 300 (optional light).

The split mirrors the brand: Sora = voice (scarce, characterful), Roboto = function (ubiquitous, legible). A monospace (e.g. JetBrains Mono) only if code/IDs are ever shown — not needed for v1.

A restrained scale — few sizes, consistent weights. Calm interfaces don't shout with type.

| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Display / page title | Sora | 28px | 600 | One per screen (e.g. "Dashboard") |
| Section heading | Sora | 20px | 600 | Card and section titles |
| Subheading | Sora | 16px | 500 | Sub-sections |
| Body | Roboto | 14px | 400 | Default text, task titles |
| Body small / label | Roboto | 13px | 500 / 400 | Form labels, secondary info |
| Caption / meta | Roboto | 12px | 400 | Timestamps, hints, counts |

Line height ~1.5 for Roboto body, tighter (~1.2) for Sora headings. Avoid more than two weights in a single view. Headings use Sora; everything functional and small uses Roboto.

## Logo & Brand Mark

**Symbol.** A rounded square tile in the Soft Indigo system with a **vertical "moon-phase" split**: the left portion is `accent` (`#7C74D6`), the right portion is `accent-strong` (`#5A52B5`), giving a crafted two-tone depth. A white capital **N** (rounded strokes) sits over the split. The two-tone split intentionally echoes the accent ramp, tying the logo to the UI palette.

**Wordmark.** "Nuvela" in **Sora**, tight tracking (~-0.03em). The first **N is `accent` (`#7C74D6`) and slightly bolder (600 vs 500)** — a deliberate brand accent that ties the wordmark to the symbol's N. The rest of the word is `text-primary`.

**Lockups & variants:**
- *Primary lockup* — symbol + wordmark, horizontal (sidebar, headers).
- *Stacked lockup* — symbol above wordmark (landing/login hero).
- *Icon only* — the symbol alone (app icon, compact contexts).
- *Favicon* — the symbol at 16/20/32px; the N stroke thickens slightly at the smallest sizes to stay legible.
- *Dark background* — symbol uses the brightened tones (`#8B83E0` / `#6A61C4`), wordmark uses `accent-bright` (`#A79FEA`) for the N on `text-primary` dark.
- *Monochrome* — single-color (black or white knockout) version for constrained contexts.

**Clear space & don'ts:** keep clear space around the lockup equal to the height of the N; never recolor the symbol outside the defined tokens, never stretch, never add effects. The logo is built from the same Soft Indigo tokens as the UI, so brand and product read as one system.

## Component Style

**Shape:** softly rounded, not sharp, not pill-everything.

| Element | Radius |
|---|---|
| Buttons, inputs, chips | 8px |
| Cards, panels, modals | 12px |
| Avatars | full circle |
| Small tags/badges | 6px |

**Depth — borders over shadows.** Hierarchy comes primarily from subtle 1px borders (`border` token) and the surface/background contrast, not from heavy drop shadows. Shadows, where used, are soft and minimal:
- Cards at rest: no shadow or a barely-there shadow; rely on the border.
- Raised/floating elements (dropdowns, popovers, the task detail panel, toasts): a soft, low-opacity shadow to lift them off the canvas.
- Never heavy, dark, or large-spread shadows — they break the calm.

**Buttons:**
- Primary: `accent` fill, white text, 8px radius. One primary per view.
- Secondary: `surface` fill with a `border`, `text-primary` label (ghost/outline).
- Destructive: `danger` text or fill only for genuinely destructive actions.
- States: default, hover (slight darken/tint), focus (accent focus ring), disabled (reduced opacity), loading (inline spinner, disabled).

**Inputs:** `surface` fill, 1px `border`, 8px radius, clear focus state (accent ring). Error state uses `danger` border + message.

**Cards:** `surface` fill, 1px `border`, 12px radius, generous internal padding (16–20px).

**Avatars:** circular; image when available, otherwise initials on a colored background (color derived deterministically from the name); stacked with slight overlap and a `+N` overflow; muted dashed-circle placeholder for unassigned.

## Spacing

A consistent 4px-based scale — this rhythm is a large part of what makes a UI feel "designed by one hand."

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`

Conventions: 32px page padding; 24px between major sections; 16px between related groups; 12–16px card padding; 8px between tight elements (icon + label). Generous whitespace is a feature, not wasted space — it's where the calm comes from.

**Layout grammar (consistent across all app screens):**
- Left sidebar: 256px wide, `bg` fill, role-aware nav.
- Top bar: 64px tall, `bg` fill, global search + notification bell + theme toggle + account menu.
- Main content: `bg` canvas, 32px padding, cards on `surface`.

## Dark / Light Mode

**Both, with a toggle** (the toggle lives in the top bar and account settings). Neither is "primary" — both are first-class and fully designed. This is why every color above is defined as a semantic token with light and dark values: the same components render correctly in both modes by swapping token values, with no per-screen rework.

Dark mode specifics: the accent brightens (`accent-dark-mode` / `accent-bright`) to hold presence against the dark canvas; surfaces step up from the `bg` rather than using pure black; borders become subtle light-on-dark. Avoid pure `#000000` backgrounds — the dark canvas is a deep neutral (`#16181D`), which is calmer.

## Mobile Responsiveness

Fully responsive; desktop-first design, but every screen must work on mobile.

- The sidebar collapses to a hamburger/drawer; on mobile a bottom tab bar may surface the top 3–4 nav items.
- The Kanban board scrolls horizontally across columns; the task detail opens as a full-screen overlay rather than a side panel.
- Tables (user management) reflow to stacked cards on narrow screens.
- Touch targets ≥ 44px; tap-friendly spacing.
- Modals/dialogs become full-screen or bottom-sheet on mobile.

## Accessibility

- **WCAG AA contrast** for all text and meaningful UI. The accent ramp is built around this — `accent-strong` / `accent-bright` exist specifically so accent text passes contrast that the base `#7C74D6` would fail on white.
- Body text ≥ 14px (Nuvela uses 14px body, 12px only for non-essential meta).
- Visible focus states on all interactive elements (accent focus ring) — never remove focus outlines.
- Color is never the sole signal: status uses icon/label + color, not color alone (e.g. priority shows a label, not just a hue).
- Avatar tooltips and `aria-label`s carry the full name behind initials/overflow.
- The locked Completed column (PM-gated) communicates its disabled state with an icon + tooltip, not color alone.

## Stack Mapping (so the brief is directly buildable)

- **shadcn/ui + Tailwind** is the component foundation; these tokens map to the Tailwind theme config and shadcn's CSS-variable theming (which is built for exactly this light/dark token model).
- Components are assembled from the *same* shadcn primitives everywhere, which is what guarantees the "hand-designed, consistent" result at build time — consistency by construction, not by manual matching.
- **Lucide** icons throughout (shadcn's native icon set), consistent stroke weight and size.
- dnd-kit for the board; its drag states should respect these tokens (lifted card gets the soft raised shadow).
- **Fonts** loaded via `next/font/google`: Sora (display/headings/wordmark) and Roboto (UI/body). Both are free, self-hosted by Next.js at build for performance.

---

## Per-Screen Visual Direction (applying the system)

- **Landing / auth:** centered, spacious, minimal; the accent appears only on the primary CTA. Calm first impression.
- **Dashboard:** neutral stat cards with the accent reserved for the single key number or the active filter; project progress bars use the accent at low emphasis.
- **Board:** the calmest, most spacious screen; columns separated by whitespace not heavy lines; cards are `surface` with subtle borders; the accent marks the active column header and the primary "New task" button only. The PM-gated Completed column shows its lock state with an icon, muted treatment, and tooltip.
- **Task detail panel:** raised surface with the soft floating shadow; two-column calm layout; the comment thread reads like a quiet chat; accent only on the send action and @mentions.
- **User management:** clean table, `surface` rows, muted status pills (Active/Pending/Deactivated using semantic tints); the create-user modal is a centered raised surface.
- **Notifications:** unread marked with a small accent dot (not a loud background); read items recede; calm list rhythm.
- **Empty states:** generous whitespace, a quiet illustration or icon, one clear primary action in the accent — never a blank void.

---

*This Design Brief is the locked visual baseline and the source of truth for the high-fidelity design and the coded UI. The Backend Schema and Implementation Plan complete the planning suite; the high-fidelity screens are built against the tokens and component rules defined here, which is what delivers a consistent, hand-designed result across every screen.*
