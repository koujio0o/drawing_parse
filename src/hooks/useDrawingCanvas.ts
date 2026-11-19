import { useState, useRef, useCallback, useEffect } from 'react';
import type { UndoStackHandle } from './useUndoStack';
import type { Point, Stroke } from '../types/drawing';

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
  /** Eraser stroke width in pixels. Defaults to 20. */
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
    onPointerUp: (e?: React.PointerEvent) => void;
    onPointerCancel: (e?: React.PointerEvent) => void;
    onLostPointerCapture?: (e?: React.PointerEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
  };
  /** Redraws all strokes on the canvas */
  redrawAll: (ctx: CanvasRenderingContext2D, strokes: Stroke[]) => void;
}

/**
 * Hook that handles pen / eraser vector drawing on a 2D canvas overlay.
 */
const useDrawingCanvas = ({
  undoStack,
  palette = [...DEFAULT_PALETTE],
  penWidth = 3,
  eraserWidth = 20,
}: UseDrawingCanvasOptions): UseDrawingCanvasReturn => {
  const [currentTool, setCurrentToolState] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColorState] = useState<string>(palette[0]);

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

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  // Tracks the actual tool used for the current stroke (to override UI state if using touch)
  const activeToolRef = useRef<'pen' | 'eraser'>('pen');
  const activePointerIdRef = useRef<number | null>(null);
  const activePointerTypeRef = useRef<string | null>(null);
  const lastPenTimeRef = useRef<number>(0);
  const activeTouchCountRef = useRef<number>(0);
  const undoTriggeredRef = useRef(false);

  const redrawAll = useCallback((ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;

      const isEraser = stroke.tool === 'eraser';
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : stroke.color;
        ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
  }, []);

  const releaseCaptureIfHeld = useCallback((pointerId: number | null) => {
    if (pointerId === null) return;
    const canvas = undoStack.canvasRef?.current ?? undoStack.ctxRef.current?.canvas;
    if (!canvas) return;
    try {
      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore if pointer capture is already released or unsupported
    }
  }, [undoStack]);

  /** Cancel the current in-progress stroke and restore the canvas to the last committed state. */
  const cancelCurrentStroke = useCallback(() => {
    const prevId = activePointerIdRef.current;
    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    activePointerTypeRef.current = null;
    currentStrokeRef.current = [];
    releaseCaptureIfHeld(prevId);

    const ctx = undoStack.ctxRef.current;
    if (ctx) {
      redrawAll(ctx, undoStack.getCurrentStrokes());
    }
  }, [undoStack, redrawAll, releaseCaptureIfHeld]);

  /** Finalize and commit the current in-progress stroke to the undo stack. */
  const commitCurrentStroke = useCallback(() => {
    const prevId = activePointerIdRef.current;
    const wasDrawing = isDrawingRef.current;
    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    activePointerTypeRef.current = null;
    releaseCaptureIfHeld(prevId);

    if (wasDrawing && currentStrokeRef.current.length > 0) {
      const stroke: Stroke = {
        tool: activeToolRef.current,
        color: colorRef.current,
        width: activeToolRef.current === 'eraser' ? eraserWidth : penWidth,
        points: currentStrokeRef.current,
      };
      undoStack.pushStroke(stroke);
    }
    currentStrokeRef.current = [];
  }, [undoStack, eraserWidth, penWidth, releaseCaptureIfHeld]);

  /** Begin a new stroke from a pointer event. */
  const beginStroke = useCallback(
    (
      clientX: number,
      clientY: number,
      pointerId: number,
      pointerType: string,
      target?: EventTarget | null,
    ) => {
      const canvas =
        (target instanceof HTMLCanvasElement ? target : null) ??
        undoStack.canvasRef?.current ??
        undoStack.ctxRef.current?.canvas ??
        null;
      const ctx = undoStack.ctxRef.current ?? canvas?.getContext('2d') ?? null;
      if (!ctx) return;
      if (!undoStack.ctxRef.current) {
        undoStack.ctxRef.current = ctx;
      }

      if (canvas) {
        try {
          canvas.setPointerCapture(pointerId);
        } catch {
          // Ignore if setPointerCapture fails (e.g. synthetic events)
        }
      }

      activePointerIdRef.current = pointerId;
      activePointerTypeRef.current = pointerType;
      isDrawingRef.current = true;

      const point = { x: clientX, y: clientY };
      currentStrokeRef.current = [point];

      // Auto-switch to eraser only if touching with a finger
      activeToolRef.current = pointerType === 'touch' ? 'eraser' : toolRef.current;
      const tool = activeToolRef.current;
      const width = tool === 'eraser' ? eraserWidth : penWidth;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(clientX, clientY, width / 2, 0, Math.PI * 2);
      ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : colorRef.current;
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.fill();
    },
    [undoStack, eraserWidth, penWidth],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pointerType = e.pointerType || 'mouse';

      // Ignore non-primary mouse buttons (e.g. right-click orbit)
      if (pointerType === 'mouse' && e.button !== 0) return;

      if (pointerType === 'pen') {
        lastPenTimeRef.current = performance.now();
        // Pen always takes priority: cancel palm touch or commit an unclosed pen stroke
        if (isDrawingRef.current) {
          if (activePointerTypeRef.current === 'touch') {
            cancelCurrentStroke();
          } else {
            commitCurrentStroke();
          }
        }
      } else if (pointerType === 'touch') {
        // Palm rejection: ignore touch if pen is active, was used just moments ago, or during multi-touch
        if (
          activePointerTypeRef.current === 'pen' ||
          activePointerTypeRef.current === 'mouse' ||
          performance.now() - lastPenTimeRef.current < 250 ||
          activeTouchCountRef.current >= 2
        ) {
          return;
        }
        // If another touch is already drawing, a second finger came down (pinch zoom / 3-finger undo)
        if (isDrawingRef.current) {
          if (activePointerTypeRef.current === 'touch') {
            cancelCurrentStroke();
          }
          return;
        }
      } else {
        // Mouse or other pointer types
        if (isDrawingRef.current) {
          if (activePointerTypeRef.current === 'touch') {
            cancelCurrentStroke();
          } else {
            commitCurrentStroke();
          }
        }
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      beginStroke(e.clientX, e.clientY, e.pointerId, pointerType, e.currentTarget);
    },
    [beginStroke, cancelCurrentStroke, commitCurrentStroke],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pointerType = e.pointerType || 'mouse';

      if (pointerType === 'pen') {
        lastPenTimeRef.current = performance.now();

        // If the pen hovers or moves while a palm touch-eraser stroke is active, cancel the palm stroke
        if (isDrawingRef.current && activePointerTypeRef.current === 'touch') {
          cancelCurrentStroke();
        }

        const isPenPressed = (e.buttons & 1) === 1 || e.pressure > 0;

        // Recovery: if pointerdown was missed/swallowed by the browser, start drawing immediately on move
        if (isPenPressed && (!isDrawingRef.current || activePointerTypeRef.current !== 'pen')) {
          if (e.cancelable) e.preventDefault();
          beginStroke(e.clientX, e.clientY, e.pointerId, 'pen', e.currentTarget);
          return;
        }

        // If pen is already drawing, keep activePointerId synced to the pen (there is only ever one pen)
        if (isDrawingRef.current && activePointerTypeRef.current === 'pen') {
          if (!isPenPressed) {
            // Pen lifted into hover without firing pointerup
            commitCurrentStroke();
            return;
          }
          activePointerIdRef.current = e.pointerId;
        }
      }

      if (!isDrawingRef.current || activePointerIdRef.current !== e.pointerId) return;

      // If multi-touch started while a single-finger touch stroke was active, cancel it
      if (pointerType === 'touch' && activeTouchCountRef.current >= 2) {
        cancelCurrentStroke();
        return;
      }

      const ctx = undoStack.ctxRef.current;
      if (!ctx) return;

      if (e.cancelable) {
        e.preventDefault();
      }

      const tool = activeToolRef.current;
      const width = tool === 'eraser' ? eraserWidth : penWidth;

      const coalescedEvents =
        typeof e.nativeEvent.getCoalescedEvents === 'function'
          ? e.nativeEvent.getCoalescedEvents()
          : [];
      const eventsToProcess = coalescedEvents.length > 0 ? coalescedEvents : [e.nativeEvent];

      const lastPoint = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      if (!lastPoint) return;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.lineWidth = width;
      ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : colorRef.current;

      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);

      for (const ev of eventsToProcess) {
        const pt = { x: ev.clientX, y: ev.clientY };
        ctx.lineTo(pt.x, pt.y);
        currentStrokeRef.current.push(pt);
      }

      ctx.stroke();
    },
    [undoStack, eraserWidth, penWidth, beginStroke, cancelCurrentStroke, commitCurrentStroke],
  );

  const onPointerUp = useCallback(
    (e?: React.PointerEvent) => {
      if (e?.pointerType === 'pen') {
        lastPenTimeRef.current = performance.now();
      }
      if (
        e &&
        activePointerIdRef.current !== null &&
        activePointerIdRef.current !== e.pointerId &&
        !(e.pointerType === 'pen' && activePointerTypeRef.current === 'pen')
      ) {
        return;
      }
      if (!isDrawingRef.current) return;

      commitCurrentStroke();
    },
    [commitCurrentStroke],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      activeTouchCountRef.current = e.touches.length;
      if (e.touches.length >= 2 && isDrawingRef.current && activePointerTypeRef.current === 'touch') {
        cancelCurrentStroke();
      }
      if (e.touches.length === 3) {
        if (!undoTriggeredRef.current) {
          undoTriggeredRef.current = true;
          const ctx = undoStack.ctxRef.current;
          if (ctx) {
            undoStack.performUndo((strokes) => redrawAll(ctx, strokes));
          }
        }
      }
    },
    [undoStack, redrawAll, cancelCurrentStroke],
  );

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    activeTouchCountRef.current = e.touches.length;
    if (e.touches.length < 3) {
      undoTriggeredRef.current = false;
    }
  }, []);

  // Attach native non-passive touch listeners (to disable iPadOS Apple Pencil Scribble & gesture delays)
  // and window-level pointerup/cancel safety listeners (so activePointerId can never get wedged).
  useEffect(() => {
    const canvas = undoStack.canvasRef?.current ?? undoStack.ctxRef.current?.canvas;
    if (!canvas) return;

    const handleNativeTouchStart = (e: TouchEvent) => {
      activeTouchCountRef.current = e.touches.length;
      // Prevent iPadOS Scribble (handwriting recognition) and Safari gesture delay on the canvas
      if (e.cancelable) {
        e.preventDefault();
      }
      if (e.touches.length >= 2 && isDrawingRef.current && activePointerTypeRef.current === 'touch') {
        cancelCurrentStroke();
      }
      if (e.touches.length === 3 && !undoTriggeredRef.current) {
        undoTriggeredRef.current = true;
        const ctx = undoStack.ctxRef.current;
        if (ctx) {
          undoStack.performUndo((strokes) => redrawAll(ctx, strokes));
        }
      }
    };

    const handleNativeTouchMove = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    const handleNativeTouchEnd = (e: TouchEvent) => {
      activeTouchCountRef.current = e.touches.length;
      if (e.touches.length < 3) {
        undoTriggeredRef.current = false;
      }
    };

    const handleWindowPointerEnd = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      if (
        activePointerIdRef.current === e.pointerId ||
        (e.pointerType === 'pen' && activePointerTypeRef.current === 'pen')
      ) {
        commitCurrentStroke();
      }
    };

    const handleWindowBlur = () => {
      if (isDrawingRef.current) {
        commitCurrentStroke();
      }
    };

    canvas.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleNativeTouchEnd);
    canvas.addEventListener('touchcancel', handleNativeTouchEnd);

    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      canvas.removeEventListener('touchstart', handleNativeTouchStart);
      canvas.removeEventListener('touchmove', handleNativeTouchMove);
      canvas.removeEventListener('touchend', handleNativeTouchEnd);
      canvas.removeEventListener('touchcancel', handleNativeTouchEnd);

      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [undoStack, redrawAll, cancelCurrentStroke, commitCurrentStroke]);

  return {
    currentTool,
    setCurrentTool,
    currentColor,
    setCurrentColor,
    palette,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onLostPointerCapture: onPointerUp,
      onTouchStart,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
    redrawAll,
  };
};

export default useDrawingCanvas;
