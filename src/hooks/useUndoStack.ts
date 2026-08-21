import { useEffect, useRef, useCallback, type RefObject, type MutableRefObject } from 'react';
import type { Stroke } from '../types/drawing';

/** Options for the useUndoStack hook. */
export interface UseUndoStackOptions {
  /** Ref to the canvas element managed by this undo stack. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Maximum number of undo snapshots to retain. Defaults to 20. */
  maxSize?: number;
}

/** Handle returned by the useUndoStack hook. */
export interface UndoStackHandle {
  /** Get the current array of strokes. */
  getCurrentStrokes: () => Stroke[];
  /** Push a new stroke onto the stack. */
  pushStroke: (stroke: Stroke) => void;
  /** Pop the last stroke and restore it, calling redrawAll with the new state. */
  performUndo: (redrawAll?: (strokes: Stroke[]) => void) => void;
  /** Push an empty state to the history, calling redrawAll. */
  clearAll: (redrawAll?: (strokes: Stroke[]) => void) => void;
  /** Empty the undo stack entirely. */
  reset: () => void;
  /** Mutable ref to the 2D rendering context initialised by this hook. */
  ctxRef: MutableRefObject<CanvasRenderingContext2D | null>;
}

/**
 * Hook that manages an undo stack for a 2D drawing canvas using vector strokes.
 *
 * @param options - Configuration including the canvas ref and optional max size.
 * @returns An {@link UndoStackHandle} with pushStroke/performUndo/clearAll/reset helpers and the context ref.
 */
const useUndoStack = ({ canvasRef, maxSize = 20 }: UseUndoStackOptions): UndoStackHandle => {
  const historyRef = useRef<Stroke[][]>([[]]);
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
  }, [canvasRef]);

  const getCurrentStrokes = useCallback(() => {
    return historyRef.current[historyRef.current.length - 1] || [];
  }, []);

  const pushStroke = useCallback((stroke: Stroke) => {
    const currentState = getCurrentStrokes();
    const newState = [...currentState, stroke];
    
    historyRef.current.push(newState);
    if (historyRef.current.length > maxSize) {
      historyRef.current.shift();
    }
  }, [getCurrentStrokes, maxSize]);

  const performUndo = useCallback((redrawAll?: (strokes: Stroke[]) => void) => {
    if (historyRef.current.length > 1) {
      historyRef.current.pop();
    }
    if (redrawAll) {
      redrawAll(getCurrentStrokes());
    }
  }, [getCurrentStrokes]);

  const clearAll = useCallback((redrawAll?: (strokes: Stroke[]) => void) => {
    historyRef.current.push([]);
    if (historyRef.current.length > maxSize) {
      historyRef.current.shift();
    }
    if (redrawAll) {
      redrawAll([]);
    }
  }, [maxSize]);

  const reset = useCallback(() => {
    historyRef.current = [[]];
  }, []);

  return { getCurrentStrokes, pushStroke, performUndo, clearAll, reset, ctxRef };
};

export default useUndoStack;
