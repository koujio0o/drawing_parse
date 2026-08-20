import { useEffect, useRef, type RefObject } from 'react';

/**
 * Options for the useZoomControls hook.
 */
export interface UseZoomControlsOptions {
  /** Ref to the canvas element to attach zoom listeners to. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Minimum allowed zoom level. @default 0.1 */
  minZoom?: number;
  /** Maximum allowed zoom level. @default 5.0 */
  maxZoom?: number;
  /** Sensitivity multiplier for mouse wheel zoom. @default 0.005 */
  wheelSensitivity?: number;
  /** Callback invoked with the new clamped zoom value. */
  onZoomChange: (zoom: number) => void;
  /** Getter that returns the current zoom value. */
  getZoom: () => number;
}

/**
 * Handles pinch-to-zoom (touch) and mouse wheel zoom on a canvas element.
 *
 * Uses the stable ref pattern: event listeners are bound once on mount
 * and read the latest callback/getter values through refs, so the
 * consumer doesn't need stable function references.
 *
 * @example
 * ```tsx
 * useZoomControls({
 *   canvasRef,
 *   onZoomChange: (z) => camera.setZoomSync(z),
 *   getZoom: () => camera.sr.current.zoom,
 * });
 * ```
 */
function useZoomControls({
  canvasRef,
  minZoom = 0.1,
  maxZoom = 5.0,
  wheelSensitivity = 0.005,
  onZoomChange,
  getZoom,
}: UseZoomControlsOptions): void {
  // --- Stable ref pattern (Style A) ---
  // Store the latest options in a ref so the event handlers
  // (bound once with [] deps) always read fresh values.
  const optRef = useRef({ minZoom, maxZoom, wheelSensitivity, onZoomChange, getZoom });
  optRef.current = { minZoom, maxZoom, wheelSensitivity, onZoomChange, getZoom };

  // Pinch state refs
  const initialPinchDist = useRef<number | null>(null);
  const initialZoom = useRef<number>(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /** Euclidean distance between two touch points. */
    const touchDist = (t1: Touch, t2: Touch): number =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    /** Clamp a value to [min, max]. */
    const clamp = (v: number, min: number, max: number): number =>
      Math.min(max, Math.max(min, v));

    // --- Touch handlers ---

    const handleTouchStart = (e: TouchEvent): void => {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialPinchDist.current = touchDist(e.touches[0], e.touches[1]);
        initialZoom.current = optRef.current.getZoom();
      }
    };

    const handleTouchMove = (e: TouchEvent): void => {
      if (e.touches.length === 2 && initialPinchDist.current !== null) {
        e.preventDefault();
        const { minZoom: min, maxZoom: max, onZoomChange: cb } = optRef.current;
        const currentDist = touchDist(e.touches[0], e.touches[1]);
        const newZoom = clamp(
          initialZoom.current * (currentDist / initialPinchDist.current),
          min,
          max,
        );
        cb(newZoom);
      }
    };

    const handleTouchEnd = (): void => {
      initialPinchDist.current = null;
    };

    // --- Wheel handler ---

    const handleWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const { minZoom: min, maxZoom: max, wheelSensitivity: sens, onZoomChange: cb, getZoom: gz } =
        optRef.current;
      const newZoom = clamp(gz() - e.deltaY * sens, min, max);
      cb(newZoom);
    };

    // --- Bind listeners (once) ---

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
      canvas.removeEventListener('wheel', handleWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default useZoomControls;
