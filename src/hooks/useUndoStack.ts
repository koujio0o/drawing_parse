import { useEffect, useRef, useCallback, type RefObject, type MutableRefObject } from 'react';

/** Options for the useUndoStack hook. */
export interface UseUndoStackOptions {
  /** Ref to the canvas element managed by this undo stack. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Maximum number of undo snapshots to retain. Defaults to 20. */
  maxSize?: number;
}

/** Handle returned by the useUndoStack hook. */
export interface UndoStackHandle {
  /** Capture the current canvas state and push it onto the undo stack. */
  pushSnapshot: () => void;
  /** Pop the last snapshot and restore it, or clear the canvas if the stack is empty. */
  performUndo: () => void;
  /**
   * Push a snapshot of the current drawing, then clear the canvas.
   * The snapshot-first ordering ensures the user can undo back to the
   * pre-clear state (fixing the original bug where clear happened before push).
   */
  clearAll: () => void;
  /** Empty the undo stack entirely (e.g. when generating a new problem). */
  reset: () => void;
  /** Mutable ref to the 2D rendering context initialised by this hook. */
  ctxRef: MutableRefObject<CanvasRenderingContext2D | null>;
}

/**
 * Hook that manages an undo stack for a 2D drawing canvas.
 *
 * The stack is stored in a ref (not state) so that pushes/pops do not trigger
 * React re-renders. A `Ctrl+Z` / `Cmd+Z` keyboard shortcut is registered
 * automatically and cleaned up on unmount.
 *
 * @param options - Configuration including the canvas ref and optional max size.
 * @returns An {@link UndoStackHandle} with push/undo/clear/reset helpers and the context ref.
 */
const useUndoStack = ({ canvasRef, maxSize = 20 }: UseUndoStackOptions): UndoStackHandle => {
  const stackRef = useRef<ImageData[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Initialise the 2D context once the canvas is mounted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctxRef.current = ctx;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushSnapshot = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    stackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (stackRef.current.length > maxSize) {
      stackRef.current.shift();
    }
  }, [canvasRef, maxSize]);

  const performUndo = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    if (stackRef.current.length > 0) {
      ctx.putImageData(stackRef.current.pop()!, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [canvasRef]);

  const clearAll = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // BUG FIX: push snapshot FIRST so the user can undo back to pre-clear state.
    pushSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef, pushSnapshot]);

  const reset = useCallback(() => {
    stackRef.current = [];
  }, []);

  // Register Ctrl+Z / Cmd+Z keyboard shortcut.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        performUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo]);

  return { pushSnapshot, performUndo, clearAll, reset, ctxRef };
};

export default useUndoStack;
