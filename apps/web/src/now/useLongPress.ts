import { useEffect, useRef, type PointerEvent } from 'react';

/** How long a press must be held, and how far it may drift, to count as a long press. */
export const LONG_PRESS_MS = 600;
const SLOP_PX = 12;

/**
 * Pointer handlers that call onLongPress after the pointer has been held still for
 * LONG_PRESS_MS. Moving, lifting or cancelling the pointer first aborts it, so scrolls and
 * taps never trigger it.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };

  useEffect(() => cancel, []);

  return {
    onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      cancel();
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        cancel();
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove(e: PointerEvent) {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // A long touch would otherwise open the system's context menu or text callout.
    onContextMenu(e: { preventDefault(): void }) {
      e.preventDefault();
    },
  };
}
