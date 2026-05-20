---
name: PayPal Vault Playground
description: Internal developer tool for testing PayPal JSv5 Vault flows
colors:
  slate-900: "#0f172a"
  slate-700: "#334155"
  slate-600: "#475569"
  slate-400: "#94a3b8"
  slate-200: "#e2e8f0"
  slate-100: "#f1f5f9"
  slate-50: "#f8fafc"
  surface: "#ffffff"
  blue-600: "#2563eb"
  blue-500: "#3b82f6"
  blue-50: "#eff6ff"
  emerald-600: "#059669"
  emerald-500: "#10b981"
  emerald-50: "#ecfdf5"
  violet-600: "#7c3aed"
  violet-500: "#8b5cf6"
  violet-50: "#f5f3ff"
  amber-500: "#f59e0b"
  amber-50: "#fffbeb"
  rose-500: "#f43f5e"
  sky-400: "#38bdf8"
typography:
  display:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.blue-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-success:
    backgroundColor: "{colors.emerald-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
---

# Design System: PayPal Vault Playground

## 1. Overview

**Creative North Star: "The Precision Lab"**

This is a developer's instrument, not a product showcase. Every surface exists to help an engineer configure, execute, and verify a PayPal vault flow — nothing more. The visual language is that of a well-organized workbench: clean surfaces, clear labeling, purposeful color-coding. There is no decoration that does not do work.

The system is built on a single off-white canvas (`#f8fafc`) with white panels that sit flush against it, separated by thin `border-slate-200` borders rather than shadows. Depth is reserved for state: hover reveals a subtle shadow, an active selection gains a border accent, a loading overlay rises above the page. Color is applied only where it carries semantic meaning — blue for card flows, emerald for save-only flows, violet for API and 3rd-party, amber for 1st-party direct merchant.

This system explicitly rejects: gradient backgrounds that add atmosphere but not information; `rounded-2xl` panels that evoke a marketing landing page; `shadow-lg` on every card regardless of state; section headers so muted they fail to organize the page; accent colors used decoratively without semantic justification.

**Key Characteristics:**
- White panels on `slate-50` canvas, separated by `border border-slate-200` (no default shadows)
- Color-coded `border-l-4` stripes on flow cards for instant category recognition
- `font-mono` for all machine-readable values: IDs, tokens, card numbers
- Elevation earned through interaction — shadows appear only on hover or modal context
- Terminal-style result area: dark, scannable, unambiguous status

## 2. Colors

A near-monochromatic slate base with four purposeful accent families, each owning a semantic domain.

### Primary
- **Action Blue** (`#2563eb`): Primary interactive actions — Pay Now, submit buttons, active toggle states, "With Purchase" flow category. Never decorative.
- **Action Blue Light** (`#eff6ff`): Hover backgrounds, active input highlights in blue contexts.

### Secondary
- **Vault Emerald** (`#059669`): "Without Purchase / Save Only" flow category. Success state in result terminal.
- **Vault Emerald Light** (`#ecfdf5`): Hover backgrounds and success tints.

### Tertiary
- **API Violet** (`#7c3aed`): "Raw API Demo" flow category and 3rd Party auth mode.
- **1st Party Amber** (`#f59e0b`): Direct merchant mode. Amber reads as "direct" against violet's "partner".

### Neutral
- **Page Canvas** (`#f8fafc`): Page background — solid, never gradient.
- **Panel Surface** (`#ffffff`): All content panels.
- **Divider** (`#e2e8f0`): Panel borders, input borders. 1px.
- **Subtle Fill** (`#f1f5f9`): Read-only input backgrounds, inset secondary panels.
- **Secondary Text** (`#475569`): Body text, field values.
- **Muted Text** (`#94a3b8`): Section header labels, placeholders.
- **Error** (`#f43f5e`): Validation errors, missing required field warnings.
- **Info** (`#38bdf8`): Processing state in result terminal.

### Named Rules
**The Semantic-Only Rule.** Accent colors appear only when they carry category or state meaning. A blue dot on a non-blue section is forbidden.

**The No-Gradient Rule.** There are no gradients in this system. The sole exception is `CardCopyInfo`'s dark card (`from-slate-800 to-slate-900`), which simulates a physical card surface and is not a design motif to be extended.

## 3. Typography

**UI Font:** Geist Sans (`ui-sans-serif, system-ui, sans-serif` fallback)
**Monospace Font:** Geist Mono (`ui-monospace, monospace` fallback)

**Character:** Geist Sans is precision tooling — optimized for screen rendering, no personality quirks. Geist Mono provides aligned columns for IDs and values. The pairing feels like a well-configured IDE.

### Hierarchy
- **Display** (800 weight, 24px, -0.02em): Homepage title only. One per page.
- **Title** (700 weight, 20px): Per-page `<h1>` on detail pages.
- **Section Label** (600 weight, 11px, 0.08em tracking, UPPERCASE, `text-slate-400`): Panel section headers throughout.
- **Body Strong** (600 weight, 14px): Flow card titles, form field labels.
- **Body** (400 weight, 14px, 1.5lh): Descriptions, helper text.
- **Mono** (400 weight, 12px, Geist Mono): All Client IDs, Customer IDs, Vault IDs, tokens, card numbers.

### Named Rules
**The Mono Rule.** Any value that will be copied, compared, or pasted must render in `font-mono`. Proportional font for machine-readable values is a usability failure.

## 4. Elevation

Flat by default. Panels sit against the canvas separated only by `border border-slate-200`. No shadow at rest.

Shadow appears in exactly two contexts:
1. **Hover on interactive cards:** `shadow-sm` — signals interactability.
2. **Loading overlay modal:** `shadow-2xl` — genuinely above the page.

### Named Rules
**The Flat-By-Default Rule.** Static informational panels have no shadow. Shadow on a non-interactive element is decoration pretending to be depth.

## 5. Components

### Buttons
- **Shape:** 8px radius (`rounded-lg`). Not pill.
- **Primary (blue):** `bg-blue-600 text-white rounded-lg`, hover `bg-blue-700`, `active:scale-[0.98]`.
- **Success (emerald):** `bg-emerald-600 text-white rounded-lg`. Used for save/pay-with-vault actions.
- **Disabled:** `opacity-50 cursor-not-allowed`.
- **Focus:** `focus:ring-2 focus:ring-blue-100 focus:border-blue-500`.

### Flow Cards (signature component)
Category identity via 4px left-border stripe — the most distinctive pattern in this system.
- **Shape:** `rounded-xl border border-slate-200 border-l-4`
- **With Purchase:** `border-l-blue-500`
- **Without Purchase:** `border-l-emerald-500`
- **API Demo:** `border-l-violet-500`
- **Hover:** `shadow-sm hover:border-slate-300`
- **Interior:** icon (24px) + label (14px bold) + description (12px `text-slate-400`) + chevron

### Panels
- **Corner:** 12px (`rounded-xl`)
- **Background:** White
- **Border:** `border border-slate-200`
- **Shadow:** None at rest
- **Padding:** 20px (`p-5`)

### Inputs
- **Default:** `border-2 border-slate-200 bg-white rounded-lg`
- **Read-only:** `border-slate-100 bg-slate-50 cursor-not-allowed`
- **Focus:** `focus:border-blue-500 focus:ring-2 focus:ring-blue-100`
- **Mono inputs (IDs/tokens):** always `font-mono`

### Result Terminal
Deliberately dark — `bg-[#0f1117]` — against the light canvas. The contrast is intentional and must not be softened.
- Header bar: `bg-slate-800/80` with status dot + UPPERCASE label
- Body: `font-mono text-xs`, scrollable to `max-h-96`
- JSON blocks: `bg-slate-800/60 rounded-lg border border-slate-700/40`

### Navigation Breadcrumb
`Dashboard / Page Title` pattern. Left-aligned. "Dashboard" in `text-slate-400`, separator in `text-slate-300`, current page in `text-slate-700 font-semibold`.

## 6. Do's and Don'ts

### Do:
- **Do** use `border-l-4` color stripes on flow cards to communicate category.
- **Do** render all machine-readable values in `font-mono`.
- **Do** use `bg-slate-50` solid as the page background — never gradient.
- **Do** use `border border-slate-200 rounded-xl p-5` as the default panel.
- **Do** communicate status with both color AND text label — never color alone.
- **Do** left-align all page headers — this is a tool, not a landing page.
- **Do** keep section labels (`text-xs font-semibold text-slate-400 uppercase tracking-widest`) consistent.

### Don't:
- **Don't** use `rounded-2xl` or `shadow-lg` on static panels.
- **Don't** use gradient backgrounds (`from-slate-50 via-white to-slate-100`).
- **Don't** apply accent colors decoratively — only for category or state semantics.
- **Don't** add shadows to panels at rest.
- **Don't** use proportional font for IDs, tokens, or card numbers.
- **Don't** center-align page content — tools are left-aligned.
- **Don't** make section headers so small (`text-[10px]`) they become invisible.
