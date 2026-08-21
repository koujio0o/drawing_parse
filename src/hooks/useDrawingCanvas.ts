import { useState, useRef, useCallback, type RefObject } from 'react';
import type { UndoStackHandle } from './useUndoStack';

/** Default colour palette matching the original COLORS constant. */
export const DEFAULT_PALETTE = ['#607d8b', '#ff3b30', '#34c759', '#007aff', '#111111'] as const;

/** Options for the useDrawingCanvas hook. */
export interface UseDrawingCanvasOptions {
  /** Undo stack handle (from useUndoStack) used to snapshot before each stroke. */
  undoStack: UndoStackHandle;
  /** Selectable colour palette. Defaults to {@link DEFAULT_PALETTE}. */
  palette?: string[];
  /** Pen stroke width in pixels. Defaults to 3. */
  penWidth?: number;
  /** Eraser stroke width in pixels. Defaults to 60. */
  eraserWidth?: number;
}

/** Return value of the useDrawingCanvas hook. */
export interface UseDrawingCanvasReturn {
  /** The currently active tool. */
  currentTool: 'pen' | 'eraser';
  /** Set the active tool. */
  setCurrentTool: (tool: 'pen' | 'eraser') => void;
  /** The currently selected pen colour. */
  currentColor: string;
  /** Set the pen colour. */
  setCurrentColor: (color: string) => void;
  /** The colour palette available for selection. */
  palette: string[];
  /** Pointer event handlers to attach to the canvas element. */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
  };
}

/**
 * Hook that handles pen / eraser drawing on a 2D canvas overlay.
 *
 * Pointer events are filtered so that only `pen` and `mouse` inputs are
 * accepted (touch is ignored). Tool and colour state are mirrored into refs
 * to prevent stale closures inside the pointer handlers.
 *
 * @param options - Drawing configuration including undo stack, palette, and widths.
 * @returns A {@link UseDrawingCanvasReturn} with state, setters, palette, and event handlers.
 */
const useDrawingCanvas = ({
  undoStack,
  palette = [...DEFAULT_PALETTE],
  penWidth = 3,
  eraserWidth = 60,
}: UseDrawingCanvasOptions): UseDrawingCanvasReturn => {
  const [currentTool, setCurrentToolState] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColorState] = useState<string>(palette[0]);

  // Mirror state into refs so pointer handlers always read the latest values.
  const toolRef = useRef<'pen' | 'eraser'>(currentTool);
  const colorRef = useRef<string>(currentColor);

  const setCurrentTool = useCallback((tool: 'pen' | 'eraser') => {
    toolRef.current = tool;
    setCurrentToolState(tool);
  }, []);

  const setCurrentColor = useCallback((color: string) => {
    colorRef.current = color;
    setCurrentColorState(color);
  }, []);

  // Drawing state kept in refs to avoid re-renders during strokes.
  const isDrawingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;

      const ctx = undoStack.ctxRef.current;
      if (!ctx) return;

      // Snapshot before the stroke begins.
      undoStack.pushSnapshot();

      isDrawingRef.current = true;
      lastXRef.current = e.clientX;
      lastYRef.current = e.clientY;

      const tool = toolRef.current;

      // Draw initial dot.
      ctx.beginPath();
      ctx.arc(e.clientX, e.clientY, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : colorRef.current;
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.fill();
    },
    [undoStack],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;

      const ctx = undoStack.ctxRef.current;
      if (!ctx) return;

      const tool = toolRef.current;

      ctx.beginPath();
      ctx.moveTo(lastXRef.current, lastYRef.current);
      ctx.lineTo(e.clientX, e.clientY);

      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = eraserWidth;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = penWidth;
        ctx.strokeStyle = colorRef.current;
      }

      ctx.stroke();

      lastXRef.current = e.clientX;
      lastYRef.current = e.clientY;
    },
    [undoStack, penWidth, eraserWidth],
  );

  const onPointerUp = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  return {
    currentTool,
    setCurrentTool,
    currentColor,
    setCurrentColor,
    palette,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  };
};

export default useDrawingCanvas;
