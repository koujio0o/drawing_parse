import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import useUndoStack from '../hooks/useUndoStack';
import useDrawingCanvas from '../hooks/useDrawingCanvas';
import useZoomControls from '../hooks/useZoomControls';
import usePerspectiveCamera from '../hooks/usePerspectiveCamera';
import useOrbitControls from '../hooks/useOrbitControls';
import useGifExport from '../hooks/useGifExport';
import useCanvasResize from '../hooks/useCanvasResize';
import DrawingToolbar from './DrawingToolbar';
import PerspectiveControls from './PerspectiveControls';

export default function ProliferationMode() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);

  const refs = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    thumbnailCamera: null as THREE.PerspectiveCamera | null,
    mainRenderer: null as THREE.WebGLRenderer | null,
    thumbnailRenderer: null as THREE.WebGLRenderer | null,
    targetGroup: null as THREE.Group | null,
    gridGroup: null as THREE.Group | null,
    trackGroup: null as THREE.Group | null,
    answerGroup: null as THREE.Group | null,
  });

  // Synchronous visibility state for render loop
  const visRef = useRef({ isGridVisible: false, isAnswerVisible: false });

  // --- Shared Hooks ---
  const undoStack = useUndoStack({ canvasRef: drawCanvasRef });

  const drawing = useDrawingCanvas({
    undoStack,
  });

  const doRedraw = () => {
    const ctx = undoStack.ctxRef.current;
    if (ctx) drawing.redrawAll(ctx, undoStack.getCurrentStrokes());
  };

  const renderScene = () => {
    const r = refs.current;
    if (!r.scene || !r.camera || !r.mainRenderer || !r.thumbnailRenderer || !r.thumbnailCamera || !r.targetGroup) return;

    cam.applyToCamera(r.camera, r.thumbnailCamera);
    cam.applyRotation(r.targetGroup);

    if (r.gridGroup) r.gridGroup.visible = visRef.current.isGridVisible;

    r.scene.updateMatrixWorld(true);

    // Draw Main
    if (r.trackGroup) r.trackGroup.visible = visRef.current.isAnswerVisible;
    if (r.answerGroup) r.answerGroup.visible = visRef.current.isAnswerVisible;
    r.mainRenderer.render(r.scene, r.camera);

    // Draw Thumbnail (always shows answer, no track lines)
    if (r.trackGroup) r.trackGroup.visible = false;
    if (r.answerGroup) r.answerGroup.visible = true;
    r.thumbnailRenderer.render(r.scene, r.thumbnailCamera);

    // Restore visibility
    if (r.trackGroup) r.trackGroup.visible = visRef.current.isAnswerVisible;
    if (r.answerGroup) r.answerGroup.visible = visRef.current.isAnswerVisible;
  };

  const cam = usePerspectiveCamera({
    baseZ: 20,
    onRender: renderScene,
  });

  useZoomControls({
    canvasRef: drawCanvasRef,
    onZoomChange: (z) => cam.setZoomSync(z),
    getZoom: () => cam.sr.current.zoom,
  });

  useOrbitControls({
    canvasRef: drawCanvasRef,
    cameraHandle: cam,
  });

  const gif = useGifExport({ filename: 'perspective_proliferation' });

  useCanvasResize({
    drawCanvasRef,
    ctxRef: undoStack.ctxRef,
    onResize: (w, h) => {
      const r = refs.current;
      if (r.mainRenderer) r.mainRenderer.setSize(w, h);
      if (r.thumbnailRenderer && thumbnailCanvasRef.current) {
        r.thumbnailRenderer.setSize(thumbnailCanvasRef.current.clientWidth, thumbnailCanvasRef.current.clientHeight, false);
      }
      if (r.camera) {
        r.camera.aspect = w / h;
        r.camera.updateProjectionMatrix();
        renderScene();
      }
    },
    redrawAll: doRedraw,
  });

  // --- Visibility sync helpers ---
  const setGridSync = (v: boolean) => { visRef.current.isGridVisible = v; setIsGridVisible(v); renderScene(); };
  const setAnswerSync = (v: boolean) => { visRef.current.isAnswerVisible = v; setIsAnswerVisible(v); renderScene(); };

  // --- Scene initialization ---
  useEffect(() => {
    const onContextMenu = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu, { passive: false });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f7);
    const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.lookAt(0, 0, 0);
    
    const thumbnailCamera = new THREE.PerspectiveCamera(80, 1, 0.1, 500);
    thumbnailCamera.lookAt(0, 0, 0);

    const mainRenderer = new THREE.WebGLRenderer({ canvas: mainCanvasRef.current!, antialias: true, preserveDrawingBuffer: true });
    mainRenderer.setPixelRatio(window.devicePixelRatio);
    
    const thumbnailRenderer = new THREE.WebGLRenderer({ canvas: thumbnailCanvasRef.current!, antialias: true });
    thumbnailRenderer.setPixelRatio(window.devicePixelRatio);
    
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    refs.current.scene = scene;
    refs.current.camera = camera;
    refs.current.thumbnailCamera = thumbnailCamera;
    refs.current.mainRenderer = mainRenderer;
    refs.current.thumbnailRenderer = thumbnailRenderer;

    generateRandomBlock();

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      thumbnailRenderer.dispose();
      mainRenderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Problem generation ---
  const generateRandomBlock = () => {
    const r = refs.current;
    if (!r.scene) return;

    if (r.targetGroup) {
      r.targetGroup.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        }
      });
      r.scene.remove(r.targetGroup);
    }
    r.targetGroup = new THREE.Group();

    const size = 4;
    const geoA = new THREE.BoxGeometry(size, size, size);

    const lineRadius = 0.04;
    const cylGeo = new THREE.CylinderGeometry(lineRadius, lineRadius, 1, 8);
    cylGeo.rotateX(Math.PI / 2);
    
    const addThickLine = (group: THREE.Group, p1: THREE.Vector3, p2: THREE.Vector3, mat: THREE.Material) => {
      const dist = p1.distanceTo(p2);
      if (dist < 0.01) return;
      const mesh = new THREE.Mesh(cylGeo, mat);
      mesh.position.copy(p1).lerp(p2, 0.5);
      mesh.scale.set(1, 1, dist);
      mesh.lookAt(p2);
      group.add(mesh);
    };

    const addEdgesToGroup = (group: THREE.Group, edgesGeo: THREE.EdgesGeometry, mat: THREE.Material) => {
      const pos = edgesGeo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 6) {
        const p1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]);
        const p2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]);
        addThickLine(group, p1, p2, mat);
      }
    };

    const cubeA = new THREE.Group();
    const matA = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.15 });
    cubeA.add(new THREE.Mesh(geoA, matA));
    
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    addEdgesToGroup(cubeA, new THREE.EdgesGeometry(geoA), blackMat);
    r.targetGroup.add(cubeA);

    const themeDirs = [ [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1] ];
    const randomDir = themeDirs[Math.floor(Math.random() * themeDirs.length)];
    
    const cubeB = new THREE.Group();
    const matB = new THREE.MeshBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.1 });
    const meshB = new THREE.Mesh(geoA, matB);
    meshB.position.set(randomDir[0]*size, randomDir[1]*size, randomDir[2]*size);
    cubeB.add(meshB);
    
    const edgesGeoB = new THREE.EdgesGeometry(geoA);
    edgesGeoB.translate(randomDir[0]*size, randomDir[1]*size, randomDir[2]*size);
    
    const posB = edgesGeoB.attributes.position.array;
    for (let i = 0; i < posB.length; i += 6) {
      const p1 = new THREE.Vector3(posB[i], posB[i+1], posB[i+2]);
      const p2 = new THREE.Vector3(posB[i+3], posB[i+4], posB[i+5]);
      const d1 = p1.x*randomDir[0] + p1.y*randomDir[1] + p1.z*randomDir[2];
      const d2 = p2.x*randomDir[0] + p2.y*randomDir[1] + p2.z*randomDir[2];
      if (Math.abs(d1 - size/2) < 0.01 && Math.abs(d2 - size/2) < 0.01) continue;
      addThickLine(cubeB, p1, p2, blackMat);
    }
    r.targetGroup.add(cubeB);

    const s = size / 2;
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.3 });
    r.trackGroup = new THREE.Group();
    const L = 100;

    for (const y of [-s, s]) {
      for (const z of [-s, s]) {
        addThickLine(r.trackGroup, new THREE.Vector3(-L, y, z), new THREE.Vector3(L, y, z), trackMat);
      }
    }
    for (const x of [-s, s]) {
      for (const z of [-s, s]) {
        addThickLine(r.trackGroup, new THREE.Vector3(x, -L, z), new THREE.Vector3(x, L, z), trackMat);
      }
    }
    for (const x of [-s, s]) {
      for (const y of [-s, s]) {
        addThickLine(r.trackGroup, new THREE.Vector3(x, y, -L), new THREE.Vector3(x, y, L), trackMat);
      }
    }
    r.trackGroup.visible = visRef.current.isAnswerVisible;
    r.targetGroup.add(r.trackGroup);

    r.answerGroup = new THREE.Group();
    
    const answerSolidMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const positions = [ [0,0,0], [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1] ];
    positions.forEach(p => {
      const mesh = new THREE.Mesh(geoA, answerSolidMat);
      mesh.position.set(p[0]*size, p[1]*size, p[2]*size);
      r.answerGroup!.add(mesh);
    });

    const redMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    
    addEdgesToGroup(r.answerGroup, new THREE.EdgesGeometry(geoA), redMat);

    const dirs = [ [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1] ];
    dirs.forEach(([dx, dy, dz]) => {
      const cx = dx * size, cy = dy * size, cz = dz * size;
      const edgesGeo = new THREE.EdgesGeometry(geoA);
      edgesGeo.translate(cx, cy, cz);
      
      const pos = edgesGeo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 6) {
        const p1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]);
        const p2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]);
        const d1 = p1.x*dx + p1.y*dy + p1.z*dz;
        const d2 = p2.x*dx + p2.y*dy + p2.z*dz;
        if (Math.abs(d1 - size/2) < 0.01 && Math.abs(d2 - size/2) < 0.01) continue;
        addThickLine(r.answerGroup!, p1, p2, redMat);
      }
    });
    
    r.answerGroup.visible = visRef.current.isAnswerVisible;
    r.targetGroup.add(r.answerGroup);

    if (r.gridGroup) {
      r.gridGroup.traverse((child) => {
        if ((child as THREE.LineSegments).geometry) (child as THREE.LineSegments).geometry.dispose();
        if ((child as THREE.LineSegments).material) ((child as THREE.LineSegments).material as THREE.Material).dispose();
      });
      r.scene.remove(r.gridGroup);
    }
    r.gridGroup = new THREE.Group();
    const gridColor = 0x007aff;
    const gridXZ = new THREE.GridHelper(100, 25, gridColor, gridColor); gridXZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gridXY = new THREE.GridHelper(100, 25, gridColor, gridColor); gridXY.rotation.x = Math.PI / 2; gridXY.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gridYZ = new THREE.GridHelper(100, 25, gridColor, gridColor); gridYZ.rotation.z = Math.PI / 2; gridYZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    r.gridGroup.add(gridXZ, gridXY, gridYZ);
    r.gridGroup.visible = visRef.current.isGridVisible;
    r.targetGroup.add(r.gridGroup);

    const randRx = Math.floor(Math.random() * 80 - 20);
    const randRy = Math.floor(Math.random() * 180 - 90);
    
    r.scene.add(r.targetGroup);

    // Synchronously update camera state
    cam.setRxSync(randRx);
    cam.setRySync(randRy);
    cam.setZoomSync(1.0);
    if (visRef.current.isAnswerVisible) {
      visRef.current.isAnswerVisible = false;
      setIsAnswerVisible(false);
    }

    // Clear drawing canvas and undo stack
    const ctx = undoStack.ctxRef.current;
    if (ctx && drawCanvasRef.current) {
      ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
    }
    undoStack.reset();

    renderScene();
  };

  // --- GIF capture ---
  const handleExportGif = () => {
    gif.exportGif((withAnswer, exportWidth, exportHeight) => {
      const r = refs.current;
      if (!r.scene || !r.camera || !r.mainRenderer) return '';

      if (r.trackGroup) r.trackGroup.visible = withAnswer;
      if (r.answerGroup) r.answerGroup.visible = withAnswer;
      r.mainRenderer.render(r.scene, r.camera);

      const tCanvas = document.createElement('canvas');
      tCanvas.width = exportWidth; tCanvas.height = exportHeight;
      const tCtx = tCanvas.getContext('2d')!;

      tCtx.fillStyle = '#f5f5f7';
      tCtx.fillRect(0, 0, exportWidth, exportHeight);
      tCtx.drawImage(mainCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(drawCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      
      // Restore visibility
      if (r.trackGroup) r.trackGroup.visible = visRef.current.isAnswerVisible;
      if (r.answerGroup) r.answerGroup.visible = visRef.current.isAnswerVisible;
      r.mainRenderer.render(r.scene, r.camera);

      return tCanvas.toDataURL('image/png');
    });
  };

  return (
    <>
      <canvas ref={mainCanvasRef} className="layer-canvas" style={{ zIndex: 5 }} />
      <canvas 
        ref={drawCanvasRef} 
        className="layer-canvas" 
        style={{ 
          zIndex: 10, 
          pointerEvents: 'auto', 
          cursor: 'crosshair', 
          touchAction: 'none'
        }} 
        onPointerDown={drawing.handlers.onPointerDown}
        onPointerMove={drawing.handlers.onPointerMove}
        onPointerUp={drawing.handlers.onPointerUp}
        onPointerCancel={drawing.handlers.onPointerUp}
      />

      <PerspectiveControls
        fov={cam.fov}
        rx={cam.rx}
        ry={cam.ry}
        onFovChange={cam.setFovSync}
        onRxChange={cam.setRxSync}
        onRyChange={cam.setRySync}
        isGridVisible={isGridVisible}
        onGridToggle={() => setGridSync(!isGridVisible)}
        isAnswerVisible={isAnswerVisible}
        onAnswerToggle={() => setAnswerSync(!isAnswerVisible)}
        onNextQuestion={generateRandomBlock}
        onClearAll={() => undoStack.clearAll(doRedraw)}
      />

      <div className="glass-panel" style={{ position: 'absolute', top: 20, right: 20, width: 200, height: 200, overflow: 'hidden', zIndex: 20, padding: 0 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: 12, textAlign: 'center', padding: '4px 0', zIndex: 21 }}>
          3Dサムネイル
        </div>
        <canvas ref={thumbnailCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      <DrawingToolbar
        drawing={drawing}
        onUndo={() => undoStack.performUndo(doRedraw)}
        onExportGif={handleExportGif}
        isExporting={gif.isExporting}
      />
    </>
  );
}
