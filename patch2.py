import re

with open('src/components/EyeLevelMode.tsx', 'r') as f:
    content = f.read()

# Fix cDraw issue
content = content.replace("cDraw.width = w; cDraw.height = h;", "if(drawCanvasRef.current) { drawCanvasRef.current.width = w; drawCanvasRef.current.height = h; }")

# Move setZoomSync definition up before useZoomControls
# setZoomSync definition is:
#  const setZoomSync = (v: number | ((z: number) => number)) => {
#    const newZ = typeof v === 'function' ? v(sr.current.zoom) : v;
#    sr.current.zoom = newZ; renderScene();
#  };

set_zoom_sync_def = """  const setZoomSync = (v: number | ((z: number) => number)) => {
    const newZ = typeof v === 'function' ? v(sr.current.zoom) : v;
    sr.current.zoom = newZ; renderScene();
  };"""

content = content.replace(set_zoom_sync_def, "")

use_zoom_pattern = """  useZoomControls({
    canvasRef: drawCanvasRef,
    onZoomChange: setZoomSync,
    getZoom: () => sr.current.zoom,
  });"""

content = content.replace(use_zoom_pattern, set_zoom_sync_def + "\n\n" + use_zoom_pattern)


with open('src/components/EyeLevelMode.tsx', 'w') as f:
    f.write(content)
