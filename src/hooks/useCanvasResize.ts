import { useEffect, type RefObject } from 'react';

/** Options for the useCanvasResize hook. */
export interface UseCanvasResizeOptions {
  /** Ref to the primary drawing canvas. */
  drawCanvasRef: RefObject<HTMLCanvasElement | null>;
  /** Optional refs to additional canvases (guide, answer, etc.) that should be resized in sync. */
  extraCanvasRefs?: RefObject<HTMLCanvasElement | null>[];
  /** Callback invoked after resize with the new dimensions. */
  onResize: (width: number, height: number) => void;
  /** Callback to redraw all vector strokes. */
  redrawAll: () => void;
}

/**
 * Hook that listens for window resize events and updates canvas dimensions.
 * It resizes the canvases and triggers a redraw of all vector strokes.
 *
 * @param options - Resize configuration including canvas refs and callbacks.
 */
const useCanvasResize = ({
  drawCanvasRef,
  extraCanvasRefs,
  onResize,
  redrawAll,
}: UseCanvasResizeOptions): void => {
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      const dpr = window.devicePixelRatio || 1;
      const drawCanvas = drawCanvasRef.current;
      if (drawCanvas) {
        drawCanvas.width = w * dpr;
        drawCanvas.height = h * dpr;
        const ctx = drawCanvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }

      if (extraCanvasRefs) {
        for (const ref of extraCanvasRefs) {
          const canvas = ref.current;
          if (canvas) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
          }
        }
      }

      onResize(w, h);
      redrawAll();
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
