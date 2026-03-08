

# Fix: Landing Page Mobile Layout Issues

## Problem
On desktop, the page renders correctly. On mobile (375px), the page jumps from the Personas section directly to the Footer CTA. All middle sections (Brain, Platform, Features, Metrics, Comparison, Proof, Pricing, Demo) are invisible — they exist in the DOM but are visually hidden due to z-index stacking conflicts between sticky sections and normal-flow sections.

## Root Cause
- **BrainSection** has `zIndex: 10` and `height: 300vh` with sticky inner. Sections after it (Platform with `zIndex: 1`, Features with no zIndex, etc.) render *behind* the Brain section on mobile.
- **FeaturesSection** has `height: 400vh` with sticky inner but no `zIndex`, so it also gets buried.
- Sections without explicit `position: relative` and `zIndex` get trapped in the default stacking context.

## Solution

### 1. Fix z-index stacking for ALL sections after BrainSection
Every section after BrainSection needs `position: 'relative'` and an appropriate `zIndex` to render above the sticky containers:

- **PlatformSection** (line 390): Already has `zIndex: 1` — change to `zIndex: 20`
- **FeaturesSection** (line 467): Add `zIndex: 20` and `position: 'relative'`
- **MetricsSection** (line 541): Add `position: 'relative', zIndex: 20`
- **ComparisonSection** (line 578): Add `position: 'relative', zIndex: 20`
- **ProofSection** (line 636): Already has `position: 'relative'` — add `zIndex: 20`
- **PricingSection** (line 683): Add `position: 'relative', zIndex: 20`
- **DemoSection** (line 741): Already has `position: 'relative'` — add `zIndex: 20`
- **Footer CTA + footer** (line 825/839): Add `position: 'relative', zIndex: 20`

### 2. Fix mobile-specific layout overflows

- **DemoSection grid** (line 746): Change `minmax(400px, 1fr)` to `minmax(280px, 1fr)` so it doesn't overflow on 375px screens
- **Demo form fields** (lines 774, 778): Add responsive single-column on mobile via media query or inline check
- **Comparison table**: Already has `overflowX: 'auto'` on the container — verify it works

### 3. Add mobile media query adjustments
In the existing `<style>` block (line 926), add:
```css
@media (max-width: 768px) {
  /* existing rules... */
  .demo-form-grid { grid-template-columns: 1fr !important; }
}
```

### Files Changed
- `src/pages/LandingPage.tsx` — z-index fixes on ~8 sections, responsive grid adjustments on DemoSection

