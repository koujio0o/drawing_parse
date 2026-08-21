import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { PerspectiveCameraHandle } from './usePerspectiveCamera';

export interface UseOrbitControlsOptions {
  /** Reference to the canvas element to attach listeners to */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Camera handle from usePerspectiveCamera hook */
  cameraHandle: PerspectiveCameraHandle;
  /** Sensitivity for rotation (degrees per pixel). @default 0.5 */
  sensitivity?: number;
}

/**
 * Hook to handle camera rotation (orbit) via drag on a canvas.
 * Activates on single-finger touch drag or mouse right-click drag.
 */
export function useOrbitControls({
  canvasRef,
  cameraHandle,
  sensitivity = 0.5,
}: UseOrbitControlsOptions): void {
  // Store mutable state that shouldn't trigger re-renders
  const stateRef = useRef({
    isOrbiting: false,
    lastX: 0,
    lastY: 0,
    pointerId: -1,
  });

  // Keep stable refs to avoid re-binding event listeners on every render
  const cameraHandleRef = useRef(cameraHandle);
  cameraHandleRef.current = cameraHandle;

  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      const isTouch = e.pointerType === 'touch' && e.isPrimary;
      const isMouseRight = e.pointerType === 'mouse' && e.button === 2;

      if (isTouch || isMouseRight) {
        stateRef.current.isOrbiting = true;
        stateRef.current.lastX = e.clientX;
        stateRef.current.lastY = e.clientY;
        stateRef.current.pointerId = e.pointerId;
        
        // Capture the pointer to ensure we receive move/up events even if pointer leaves canvas
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!stateRef.current.isOrbiting) return;
      if (e.pointerId !== stateRef.current.pointerId) return; // Ensure we only track the active pointer

      // Prevent default to avoid browser scrolling/pull-to-refresh on touch devices
      if (e.cancelable) {
        e.preventDefault();
      }

      const deltaX = e.clientX - stateRef.current.lastX;
      const deltaY = e.clientY - stateRef.current.lastY;

      const handle = cameraHandleRef.current;
      const sens = sensitivityRef.current;

      // Access latest synchronous rotation values
      const currentRy = handle.sr.current.ry;
      const currentRx = handle.sr.current.rx;

      const newRy = currentRy + deltaX * sens;
      let newRx = currentRx + deltaY * sens;

      // Clamp rx to [-80, 80]
      newRx = Math.max(-80, Math.min(80, newRx));

      // Apply changes synchronously to the camera handle
      handle.setRySync(newRy);
      handle.setRxSync(newRx);

      // Update last positions for the next move event
      stateRef.current.lastX = e.clientX;
      stateRef.current.lastY = e.clientY;
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      if (e.pointerId === stateRef.current.pointerId) {
        stateRef.current.isOrbiting = false;
        stateRef.current.pointerId = -1;
        
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      }
    };

    const onContextMenu = (e: Event) => {
      // Prevent the default context menu from appearing on right-click
      e.preventDefault();
    };

    // Bind listeners with { passive: false } to allow preventDefault()
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUpOrCancel, { passive: false });
    canvas.addEventListener('pointercancel', onPointerUpOrCancel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu, { passive: false });

    // Cleanup listeners on unmount
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUpOrCancel);
      canvas.removeEventListener('pointercancel', onPointerUpOrCancel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, [canvasRef]); // Only re-bind if canvasRef itself changes
}

export default useOrbitControls;
