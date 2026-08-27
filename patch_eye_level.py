import re

with open('src/components/EyeLevelMode.tsx', 'r') as f:
    content = f.read()

# Add imports
imports = """import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gifshot from 'gifshot';
import useUndoStack from '../hooks/useUndoStack';
import useDrawingCanvas from '../hooks/useDrawingCanvas';
import useZoomControls from '../hooks/useZoomControls';
import DrawingToolbar from './DrawingToolbar';"""
content = re.sub(r'import \{ useEffect, useRef, useState \} from \'react\';\nimport \* as THREE from \'three\';\nimport gifshot from \'gifshot\';', imports, content)

# Remove old tool state
content = re.sub(r'  const \[currentTool, setCurrentTool\] = useState<\'pen\' \| \'eraser\'>\(\'pen\'\);\n  const \[currentColor, setCurrentColor\] = useState<string>\(COLORS\[0\]\);\n', '', content)

# Add hooks
hooks = """  const undoStack = useUndoStack({ canvasRef: drawCanvasRef });
  const drawing = useDrawingCanvas({ undoStack, palette: COLORS as any });
  const doRedraw = () => {
    const ctx = undoStack.ctxRef.current;
    if (ctx) drawing.redrawAll(ctx, undoStack.getCurrentStrokes());
  };
  
  useZoomControls({
    canvasRef: drawCanvasRef,
    onZoomChange: setZoomSync,
    getZoom: () => sr.current.zoom,
  });"""
content = re.sub(r'  const \[isAnswerVisible, setIsAnswerVisible\] = useState\(false\);', r'  const [isAnswerVisible, setIsAnswerVisible] = useState(false);\n' + hooks, content)

# Remove ctxDraw undoStack from refs
content = re.sub(r'    undoStack: \[\] as ImageData\[\],\n    ctxDraw: null as CanvasRenderingContext2D \| null,\n', '', content)

# Update ctxDraw initialisation
content = re.sub(r'    const cDraw = drawCanvasRef.current!;\n    refs.current.ctxDraw = cDraw.getContext\(\'2d\'\);\n', '', content)
content = re.sub(r'      const tempImageData = r.undoStack.length > 0 && r.ctxDraw \? r.ctxDraw.getImageData\(0, 0, cDraw.width, cDraw.height\) : null;\n', '', content)
content = re.sub(r'      if \(r.ctxDraw\) \{\n        r.ctxDraw.lineCap = \'round\';\n        r.ctxDraw.lineJoin = \'round\';\n        if \(tempImageData\) r.ctxDraw.putImageData\(tempImageData, 0, 0\);\n      \}\n', '      doRedraw();\n', content)

# Update clearRect
content = re.sub(r'    if \(r.ctxDraw && drawCanvasRef.current\) \{\n      r.ctxDraw.clearRect\(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height\);\n    \}\n    r.undoStack = \[\];', '    undoStack.reset();\n    doRedraw();', content)

# Remove manual handlers
content = re.sub(r'  const handlePointerDown = \(e: React.PointerEvent\) => \{[\s\S]*?  const handlePointerUp = \(\) => \{ refs.current.isDrawing = false; \};', '', content)

# Remove old touch handlers
content = re.sub(r'  useEffect\(\(\) => \{\n    const canvas = drawCanvasRef.current;[\s\S]*?  \}, \[\]\);\n', '', content)

# Remove performUndo
content = re.sub(r'  const performUndo = \(\) => \{[\s\S]*?  \};\n', '', content)

# Replace keydown z performUndo with undoStack.performUndo(doRedraw)
content = re.sub(r'performUndo\(\)', 'undoStack.performUndo(doRedraw)', content)

# Replace clear all
content = re.sub(r'onClick=\{\(\) => \{ refs.current.ctxDraw\?\.clearRect[\s\S]*?\}\}', 'onClick={() => undoStack.clearAll(doRedraw)}', content)

# Replace canvas handlers
content = re.sub(r'        onPointerDown=\{handlePointerDown\}\n        onPointerMove=\{handlePointerMove\}\n        onPointerUp=\{handlePointerUp\}\n        onPointerCancel=\{handlePointerUp\}', r'        onPointerDown={drawing.handlers.onPointerDown}\n        onPointerMove={drawing.handlers.onPointerMove}\n        onPointerUp={drawing.handlers.onPointerUp}\n        onPointerCancel={drawing.handlers.onPointerUp}\n        onTouchStart={drawing.handlers.onTouchStart}\n        onTouchEnd={drawing.handlers.onTouchEnd}\n        onTouchCancel={drawing.handlers.onTouchCancel}', content)

# Replace toolbar
toolbar_pattern = r'      <div className="glass-panel" style=\{\{ position: \'absolute\', bottom: 30, right: 30, zIndex: 20, display: \'flex\', alignItems: \'center\', gap: 10, padding: 10, borderRadius: 30 \}\}>[\s\S]*?      </div>\n\n      <div style=\{\{ position: \'absolute\', bottom: 30, left: 30, zIndex: 20 \}\}>\n        <button className="glass-button btn-warning" onClick=\{handleExportGif\} disabled=\{isExporting\}>\n          \{isExporting \? \'生成中...\' : \'GIF保存\'\}\n        </button>\n      </div>'

new_toolbar = """      <DrawingToolbar
        drawing={drawing}
        onUndo={() => undoStack.performUndo(doRedraw)}
        onExportGif={handleExportGif}
        isExporting={isExporting}
      />"""

content = re.sub(toolbar_pattern, new_toolbar, content)

with open('src/components/EyeLevelMode.tsx', 'w') as f:
    f.write(content)

print("Patched EyeLevelMode.tsx")
