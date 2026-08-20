import { useEffect, type RefObject, type MutableRefObject } from 'react';

/** Options for the useCanvasResize hook. */
export interface UseCanvasResizeOptions {
  /** Ref to the primary drawing canvas. */
  drawCanvasRef: RefObject<HTMLCanvasElement | null>;
  /** Optional refs to additional canvases (guide, answer, etc.) that should be resized in sync. */
  extraCanvasRefs?: RefObject<HTMLCanvasElement | null>[];
  /** Mutable ref to the drawing 2D context (e.g. from useUndoStack). */
  ctxRef: MutableRefObject<CanvasRenderingContext2D | null>;
  /** Callback invoked after resize with the new dimensions. */
  onResize: (width: number, height: number) => void;
}

/**
 * Hook that listens for window resize events and updates canvas dimensions
 * while preserving existing drawing content.
 *
 * On each resize the hook:
 * 1. Saves the current drawing to a temporary canvas using `drawImage`
 * 2. Resizes all managed canvases to the new window dimensions
 * 3. Restores drawing context properties (`lineCap`, `lineJoin`)
 * 4. Draws the saved content back onto the resized canvas (scales properly)
 * 5. Calls the `onResize` callback
 *
 * The resize handler is also called once immediately on mount.
 *
 * @param options - Resize configuration including canvas refs, context ref, and callback.
 */
const useCanvasResize = ({
  drawCanvasRef,
  extraCanvasRefs,
  ctxRef,
  onResize,
}: UseCanvasResizeOptions): void => {
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      const drawCanvas = drawCanvasRef.current;

      if (drawCanvas) {
        // Save old dimensions before resizing
        const oldWidth = drawCanvas.width;
        const oldHeight = drawCanvas.height;

        // Save current drawing to a temporary canvas using drawImage
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = oldWidth;
        tempCanvas.height = oldHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(drawCanvas, 0, 0);
        }

        // Resize all canvases to new dimensions
        drawCanvas.width = w;
        drawCanvas.height = h;

        if (extraCanvasRefs) {
          for (const ref of extraCanvasRefs) {
            const canvas = ref.current;
            if (canvas) {
              canvas.width = w;
              canvas.height = h;
            }
          }
        }

        // Restore drawing context properties
        const ctx = ctxRef.current;
        if (ctx) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }

        // Draw the saved content back onto the resized draw canvas
        if (tempCtx) {
          const drawCtx = drawCanvas.getContext('2d');
          if (drawCtx) {
            drawCtx.drawImage(tempCanvas, 0, 0);
          }
        }
      } else {
        // No draw canvas yet — still resize extra canvases if present
        if (extraCanvasRefs) {
          for (const ref of extraCanvasRefs) {
            const canvas = ref.current;
            if (canvas) {
              canvas.width = w;
              canvas.height = h;
            }
          }
        }
      }

      onResize(w, h);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export default useCanvasResize;
