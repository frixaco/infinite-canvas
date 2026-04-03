import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";

export interface InfiniteCanvasItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VisibilityWorkerMessage {
  type: "init";
  payload: InfiniteCanvasItem[];
}

interface VisibilityWorkerResponse {
  type: "update-visibility";
  payload: Set<string>;
}

interface StoreState {
  visibleCardIds: Set<string>;
  transform: { x: number; y: number; k: number };
  viewportRect: { width: number; height: number };
  setTransform: (transform: { x: number; y: number; k: number }) => void;
  setViewportRect: (rect: { width: number; height: number }) => void;
  initItems: (items: InfiniteCanvasItem[]) => void;
}

const useVisibilityStore = createWithEqualityFn<StoreState>()((set, get) => {
  const worker = new Worker(
    new URL("./visibility-worker.ts", import.meta.url),
    { type: "module" },
  );

  let items: InfiniteCanvasItem[] = [];

  worker.onmessage = (event: MessageEvent<VisibilityWorkerResponse>) => {
    const data = event.data;
    if (data.type === "update-visibility") {
      set({ visibleCardIds: data.payload });
    }
  };

  return {
    visibleCardIds: new Set<string>(),
    transform: { x: 0, y: 0, k: 1 },
    viewportRect: { width: 0, height: 0 },
    setTransform: (transform) => {
      set({ transform });
      worker.postMessage({
        type: "init",
        payload: items,
      } satisfies VisibilityWorkerMessage);
      worker.postMessage({
        type: "calculate-visibility",
        payload: {
          transform: get().transform,
          viewportRect: get().viewportRect,
        },
      });
    },
    setViewportRect: (viewportRect) => {
      set({ viewportRect });
      worker.postMessage({
        type: "calculate-visibility",
        payload: {
          transform: get().transform,
          viewportRect: get().viewportRect,
        },
      });
    },
    initItems: (newItems: InfiniteCanvasItem[]) => {
      items = newItems;
      worker.postMessage({
        type: "init",
        payload: items,
      } satisfies VisibilityWorkerMessage);
    },
  };
}, shallow);

export interface InfiniteCanvasProps<T extends InfiniteCanvasItem> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  className?: string;
  minZoom?: number;
  maxZoom?: number;
}

export function InfiniteCanvas<T extends InfiniteCanvasItem>({
  items,
  renderItem,
  className = "",
  minZoom = 0.1,
  maxZoom = 3,
}: InfiniteCanvasProps<T>) {
  const setTransform = useVisibilityStore((state) => state.setTransform);
  const setViewportRect = useVisibilityStore((state) => state.setViewportRect);
  const initItems = useVisibilityStore((state) => state.initItems);

  const visibleCardIds = useVisibilityStore((state) => state.visibleCardIds);

  const planeRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const transformRef = useRef<{ x: number; y: number; k: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [repaintKey, setRepaintKey] = useState(0);
  const repaintKeyRef = useRef(setRepaintKey);

  const update = useCallback(() => {
    if (transformRef.current && planeRef.current) {
      const { x, y, k } = transformRef.current;
      planeRef.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      setTransform(transformRef.current);
    }
    animationFrameRef.current = null;
  }, [setTransform]);

  const scheduleUpdate = useCallback(
    (transform: d3.ZoomTransform) => {
      transformRef.current = transform;
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(update);
      }
    },
    [update],
  );

  useEffect(() => {
    if (!viewportRef.current || !planeRef.current) return;

    const viewport = d3.select<HTMLDivElement, unknown>(viewportRef.current);

    const zoom = d3
      .zoom<HTMLDivElement, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .on("zoom", (event: d3.D3ZoomEvent<HTMLDivElement, unknown>) => {
        scheduleUpdate(event.transform);
      })
      .on("end", () => {
        repaintKeyRef.current((k) => k + 1);
      });
    viewport.call(zoom);

    return () => {
      viewport.on(".zoom", null);
    };
  }, [minZoom, maxZoom, scheduleUpdate]);

  useEffect(() => {
    if (!viewportRef.current) return;

    const initialRect = viewportRef.current.getBoundingClientRect();
    setViewportRect({ width: initialRect.width, height: initialRect.height });

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setViewportRect({ width, height });
    });

    ro.observe(viewportRef.current);

    return () => ro.disconnect();
  }, [setViewportRect]);

  useEffect(() => {
    initItems(items);
  }, [items, initItems]);

  const itemsMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  const visibleItems = useMemo(() => {
    const result: T[] = [];
    for (const id of visibleCardIds) {
      const item = itemsMap.get(id);
      if (item) {
        result.push(item);
      }
    }
    return result;
  }, [visibleCardIds, itemsMap]);

  return (
    <div
      ref={viewportRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        flex: "1 1 0%",
      }}
    >
      <div
        ref={planeRef}
        style={{
          transform: "translate(0px, 0px) scale(1)",
          position: "absolute",
          top: 0,
          left: 0,
          willChange: "transform",
          pointerEvents: "none",
          transformOrigin: "0 0",
        }}
      >
        {visibleItems.map((item) => (
          <div
            key={`${item.id}-${repaintKey}`}
            style={{
              position: "absolute",
              pointerEvents: "auto",
              cursor: "pointer",
              height: item.height,
              width: item.width,
              transform: `translate(${item.x}px, ${item.y}px)`,
              willChange: "transform",
              contain: "layout style",
            }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
