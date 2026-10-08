## High-performance Infinite Canvas Implementation

### Demo

See `Example.tsx` for usage.

```bash
npm i
npx vite dev
```

### Transform control

Pass `transformRequest={{ id, x, y, k }}` to move the canvas. Change `id` for
each new command; recreating an object with the last applied ID does not replay it.
Requests require finite numeric values and a positive scale. Valid scales are
clamped to `minZoom` and `maxZoom`.

`onTransformChange` receives the latest applied transform once per animation
frame, including programmatic changes. Its callback can change without resetting
the gesture listeners.

### Files

- `InfiniteCanvas.tsx` — infinite canvas component
- `Example.tsx` — demo content
- `visibility-worker.ts` — visibility culling worker
- `main.tsx` + `index.html` — Vite app entry

### Optimizations in `InfiniteCanvas.tsx`

- Web Worker visibility culling via `visibility-worker.ts`
- render only visible items, not whole dataset
- pan/zoom transform applied imperatively to one plane node
- transform updates batched with `requestAnimationFrame`
- viewport size tracked with `ResizeObserver`
- items indexed with memoized `Map` for fast id lookup
- visible item list memoized from `visibleCardIds`
- item remount forced only after zoom end via `repaintKey`
- plane uses `will-change: transform`
- items use absolute positioning + `contain: layout style`
- plane uses `transform-origin: 0 0` for stable zoom math

### Tech stack

- React + TypeScript - component model + typed canvas/item API
- D3 zoom - battle-tested pan/zoom gesture handling and transform math
- Zustand - tiny store for shared viewport/visibility state without heavy React churn
- Web Worker visibility culling - moves visibility calculation off the main thread
- generic API: `InfiniteCanvas<T extends InfiniteCanvasItem>` - lets apps attach custom item data while keeping required layout fields
