import { useState, useRef, useCallback, type RefObject } from 'react';
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
  eraserWidth = 60,
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

  const redrawAll = useCallback((ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      
      ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      const isEraser = stroke.tool === 'eraser';
      
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : stroke.color;
        // For a single point, just draw a dot. Using pressure if > 0.
        const width = p.pressure > 0 ? p.pressure * stroke.width * 2 : stroke.width;
        ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      for (let i = 1; i < stroke.points.length; i++) {
        const p1 = stroke.points[i - 1];
        const p2 = stroke.points[i];
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : stroke.color;
        
        const segmentWidth = p2.pressure > 0 ? p2.pressure * stroke.width * 2 : stroke.width;
        ctx.lineWidth = segmentWidth;
        ctx.stroke();
      }
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;

      const ctx = undoStack.ctxRef.current;
      if (!ctx) return;

      isDrawingRef.current = true;
      const point = { x: e.clientX, y: e.clientY, pressure: e.pressure };
      currentStrokeRef.current = [point];

      const tool = toolRef.current;
      const baseWidth = tool === 'eraser' ? eraserWidth : penWidth;
      const width = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure * baseWidth * 2 : baseWidth;

      ctx.beginPath();
      ctx.arc(e.clientX, e.clientY, width / 2, 0, Math.PI * 2);
      ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : colorRef.current;
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.fill();
    },
    [undoStack, eraserWidth, penWidth],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;

      const ctx = undoStack.ctxRef.current;
      if (!ctx) return;

      const tool = toolRef.current;
      const baseWidth = tool === 'eraser' ? eraserWidth : penWidth;
      const width = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure * baseWidth * 2 : baseWidth;

      const newPoint = { x: e.clientX, y: e.clientY, pressure: e.pressure };
      const lastPoint = currentStrokeRef.current[currentStrokeRef.current.length - 1];

      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(newPoint.x, newPoint.y);

      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = width;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = width;
        ctx.strokeStyle = colorRef.current;
      }

      ctx.stroke();
      currentStrokeRef.current.push(newPoint);
    },
    [undoStack, eraserWidth, penWidth],
  );

  const onPointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokeRef.current.length > 0) {
      const stroke: Stroke = {
        tool: toolRef.current,
        color: colorRef.current,
        width: toolRef.current === 'eraser' ? eraserWidth : penWidth,
        points: currentStrokeRef.current,
      };
      undoStack.pushStroke(stroke);
      currentStrokeRef.current = [];
    }
  }, [undoStack, eraserWidth, penWidth]);

  return {
    currentTool,
    setCurrentTool,
    currentColor,
    setCurrentColor,
    palette,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
    redrawAll,
  };
};

export default useDrawingCanvas;
