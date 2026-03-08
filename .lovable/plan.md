

# Fix: Brain Section being clipped by adjacent sections

## Problem
The Brain Section (sticky `300vh` container) lacks `z-index`, so adjacent sections (Personas above, PlatformSection below) visually overlap it as the user scrolls.

## Solution
Add `zIndex` to the Brain Section's outer container and its sticky inner div to ensure it renders above neighboring sections. Also add `position: relative` + `zIndex` to adjacent sections so the stacking context is explicit.

### Changes in `src/pages/LandingPage.tsx`

1. **Brain section outer** (line 250): Add `zIndex: 10`
   ```tsx
   style={{ height: '300vh', position: 'relative', zIndex: 10 }}
   ```

2. **Brain sticky inner** (line 251-252): Add `zIndex: 10`
   ```tsx
   style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', zIndex: 10, ... }}
   ```

3. **Personas section** (above Brain): Add `position: 'relative', zIndex: 1` so it stays below.

4. **PlatformSection** (below Brain): Add `position: 'relative', zIndex: 1` so it stays below.

This ensures the green Brain section sits visually on top of its neighbors during scroll.

