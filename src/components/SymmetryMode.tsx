import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import useUndoStack from '../hooks/useUndoStack';
import useDrawingCanvas from '../hooks/useDrawingCanvas';
import useZoomControls from '../hooks/useZoomControls';
import usePerspectiveCamera from '../hooks/usePerspectiveCamera';
import useGifExport from '../hooks/useGifExport';
import useCanvasResize from '../hooks/useCanvasResize';
import useOrbitControls from '../hooks/useOrbitControls';
import DrawingToolbar from './DrawingToolbar';
import PerspectiveControls from './PerspectiveControls';

const COLORS = ['#607d8b', '#ab47bc', '#81c784', '#64b5f6', '#111111'];

export default function SymmetryMode() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isExtrudeOnly, setIsExtrudeOnly] = useState(() => {
    const saved = localStorage.getItem('symmetryIsExtrudeOnly');
    return saved ? saved === 'true' : true;
  });

  const sr = useRef({ 
    isExtrudeOnly: true
  });

  const refs = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    thumbnailCamera: null as THREE.PerspectiveCamera | null,
    mainRenderer: null as THREE.WebGLRenderer | null,
    thumbnailRenderer: null as THREE.WebGLRenderer | null,
    targetGroup: null as THREE.Group | null,
    answerGroup: null as THREE.Group | null,
    gridGroup: null as THREE.Group | null,
  });

  const visRef = useRef({ isGridVisible: false, isAnswerVisible: false });

  // --- Shared Hooks ---
  const undoStack = useUndoStack({ canvasRef: drawCanvasRef });
  const drawing = useDrawingCanvas({ undoStack, palette: COLORS as any });

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

    if (r.answerGroup) r.answerGroup.visible = visRef.current.isAnswerVisible;
    r.mainRenderer.render(r.scene, r.camera);

    // Thumbnail always shows overlay
    if (r.answerGroup) r.answerGroup.visible = true;
    r.thumbnailRenderer.render(r.scene, r.thumbnailCamera);

    // Restore
    if (r.answerGroup) r.answerGroup.visible = visRef.current.isAnswerVisible;
  };

  const cam = usePerspectiveCamera({
    baseZ: 35,
    initialFov: 50,
    fovRange: [30, 120],
    initialRx: 20,
    initialRy: -35,
    onRender: renderScene,
  });

  useOrbitControls({ canvasRef: drawCanvasRef, cameraHandle: cam });

  useZoomControls({
    canvasRef: drawCanvasRef,
    onZoomChange: (z) => cam.setZoomSync(z),
    getZoom: () => cam.sr.current.zoom,
  });

  const gif = useGifExport({ filename: 'symmetry' });

  useCanvasResize({
    drawCanvasRef,
    redrawAll: doRedraw,
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
  });

  const setIsExtrudeOnlySync = (v: boolean) => {
    sr.current.isExtrudeOnly = v;
    setIsExtrudeOnly(v);
    localStorage.setItem('symmetryIsExtrudeOnly', v.toString());
    generateRandomBlock();
  };

  const setGridSync = (v: boolean) => { visRef.current.isGridVisible = v; setIsGridVisible(v); renderScene(); };
  const setAnswerSync = (v: boolean) => { visRef.current.isAnswerVisible = v; setIsAnswerVisible(v); renderScene(); };

  useEffect(() => {
    const onContextMenu = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu, { passive: false });

    sr.current.isExtrudeOnly = isExtrudeOnly;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f7);
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    const thumbnailCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

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
    setTimeout(() => window.dispatchEvent(new Event("resize")), 10);

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      mainRenderer.dispose();
      thumbnailRenderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateRandomBlock = () => {
    const r = refs.current;
    if (!r.scene) return;

    if (r.targetGroup) r.scene.remove(r.targetGroup);
    
    r.targetGroup = new THREE.Group();
    r.answerGroup = new THREE.Group();
    
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x333333 });
    const ansFaceMat = new THREE.MeshStandardMaterial({ color: 0xffa726, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const ansEdgeMat = new THREE.LineBasicMaterial({ color: 0x8c3b00 });

    const isExtrude = sr.current.isExtrudeOnly;

    if (isExtrude) {
      // Extrude Alphabet Letters
      const profiles = [
        [ [0, 10], [4, 10], [4, 8], [1, 8], [1, 0], [0, 0] ], // T
        [ [0, 6], [2, 6], [2, 10], [4, 10], [4, 0], [2, 0], [2, 4], [0, 4] ], // H
        [ [0, 0], [1, 0], [4, 10], [2, 10] ], // V
        [ [0, 5], [0, 8], [2, 10], [4, 10], [4, 0], [2, 0], [2, 8] ], // M
        [ [0, 0], [1, 0], [1, 5], [4, 10], [2, 10], [0, 6] ], // Y
        [ [0, 0], [4, 0], [4, 10], [2, 10], [2, 2], [0, 2] ], // U
        [ [0, 4], [2, 0], [4, 0], [1.5, 5], [4, 10], [2, 10], [0, 6] ], // X
        [ [0, 10], [3, 10], [3, 8], [1, 8], [1, 2], [3, 2], [3, 0], [0, 0] ], // I
        [ [0, 10], [2, 10], [4, 0], [2, 0], [1.5, 3], [0, 3], [0, 5], [1.1, 5], [0.5, 8], [0, 8] ] // A
      ];
      const profile = profiles[Math.floor(Math.random() * profiles.length)];

      const rightShape = new THREE.Shape();
      profile.forEach((pt, i) => {
        const px = pt[0] * 1.5;
        const py = (pt[1] - 5) * 1.5;
        if (i === 0) rightShape.moveTo(px, py);
        else rightShape.lineTo(px, py);
      });
      const extrudeRight = new THREE.ExtrudeGeometry(rightShape, { depth: 2, bevelEnabled: false });
      extrudeRight.translate(0, 0, -1);
      const rightMesh = new THREE.Mesh(extrudeRight, faceMat);
      rightMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(extrudeRight), edgeMat));
      r.targetGroup.add(rightMesh);

      const leftShape = new THREE.Shape();
      const leftProfile = [...profile].reverse();
      leftProfile.forEach((pt, i) => {
        const px = -pt[0] * 1.5;
        const py = (pt[1] - 5) * 1.5;
        if (i === 0) leftShape.moveTo(px, py);
        else leftShape.lineTo(px, py);
      });
      const extrudeLeft = new THREE.ExtrudeGeometry(leftShape, { depth: 2, bevelEnabled: false });
      extrudeLeft.translate(0, 0, -1);
      const leftMesh = new THREE.Mesh(extrudeLeft, ansFaceMat);
      leftMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(extrudeLeft), ansEdgeMat));
      r.answerGroup.add(leftMesh);

    } else {
      // Lathe Geometry (Pillars / Bottles)
      const pts = [];
      const numPoints = 5 + Math.floor(Math.random() * 5);
      pts.push(new THREE.Vector2(0, -8)); // close bottom
      let lastX = 2 + Math.random() * 3;
      for (let i = 0; i < numPoints; i++) {
        const y = -8 + (16 / (numPoints - 1)) * i;
        const x = lastX + (Math.random() * 4 - 2);
        lastX = Math.max(1, Math.min(6, x));
        pts.push(new THREE.Vector2(lastX, y));
      }
      pts.push(new THREE.Vector2(0, 8)); // close top

      // Right half (-90 to +90 deg in XZ plane)
      const latheRight = new THREE.LatheGeometry(pts, 16, -Math.PI / 2, Math.PI);
      const rightMesh = new THREE.Mesh(latheRight, faceMat);
      rightMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(latheRight), edgeMat));
      r.targetGroup.add(rightMesh);

      // Left half (90 to 270 deg in XZ plane)
      const latheLeft = new THREE.LatheGeometry(pts, 16, Math.PI / 2, Math.PI);
      const leftMesh = new THREE.Mesh(latheLeft, ansFaceMat);
      leftMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(latheLeft), ansEdgeMat));
      r.answerGroup.add(leftMesh);
    }

    // Mirror Plane Guide (Semi-transparent plane at X=0)
    const planeGeo = new THREE.PlaneGeometry(30, 30);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const mirrorPlane = new THREE.Mesh(planeGeo, planeMat);
    mirrorPlane.rotation.y = Math.PI / 2;
    r.targetGroup.add(mirrorPlane);
    
    // Grid Helper on the mirror plane
    const gridHelper = new THREE.GridHelper(30, 10, 0x007aff, 0x007aff);
    gridHelper.rotation.z = Math.PI / 2;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.2;
    r.targetGroup.add(gridHelper);

    r.targetGroup.add(r.answerGroup);
    
    // Add custom grid group (XY, XZ, YZ)
    if (r.gridGroup) r.scene.remove(r.gridGroup);
    r.gridGroup = new THREE.Group();
    const gridColor = 0x007aff;
    const gSize = 40;
    const gDiv = 20;
    const gXZ = new THREE.GridHelper(gSize, gDiv, gridColor, gridColor); gXZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gXY = new THREE.GridHelper(gSize, gDiv, gridColor, gridColor); gXY.rotation.x = Math.PI / 2; gXY.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gYZ = new THREE.GridHelper(gSize, gDiv, gridColor, gridColor); gYZ.rotation.z = Math.PI / 2; gYZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    r.gridGroup.add(gXZ, gXY, gYZ);
    r.gridGroup.visible = visRef.current.isGridVisible;
    r.targetGroup.add(r.gridGroup);

    r.scene.add(r.targetGroup);

    const randRx = Math.floor(Math.random() * 60 - 10);
    const randRy = Math.floor(Math.random() * 120 - 60);
    cam.setRxSync(randRx);
    cam.setRySync(randRy);
    cam.setZoomSync(1.0);

    if (visRef.current.isAnswerVisible) {
      visRef.current.isAnswerVisible = false;
      setIsAnswerVisible(false);
    }
    
    undoStack.reset();
    const ctx = undoStack.ctxRef.current;
    if (ctx && drawCanvasRef.current) {
      ctx.clearRect(0, 0, drawCanvasRef.current.clientWidth, drawCanvasRef.current.clientHeight);
    }

    renderScene();
  };

  const handleExportGif = () => {
    gif.exportGif((withAnswer, exportWidth, exportHeight) => {
      const r = refs.current;
      if (!r.scene || !r.camera || !r.mainRenderer) return '';
      
      const tCanvas = document.createElement('canvas');
      tCanvas.width = exportWidth; tCanvas.height = exportHeight;
      const tCtx = tCanvas.getContext('2d')!;

      tCtx.fillStyle = '#f5f5f7';
      tCtx.fillRect(0, 0, exportWidth, exportHeight);

      if (r.answerGroup) r.answerGroup.visible = withAnswer;
      r.mainRenderer.render(r.scene, r.camera);
      
      tCtx.drawImage(mainCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(drawCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      
      return tCanvas.toDataURL('image/png');
    });
  };

  return (
    <>
      <div className="glass-panel" style={{ position: 'absolute', top: 20, left: 20, padding: 16, zIndex: 20, width: 220 }}>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isExtrudeOnly} onChange={e => setIsExtrudeOnlySync(e.target.checked)} />
            平面＋厚みのみに限定
          </label>
        </div>
      </div>

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
        onTouchStart={drawing.handlers.onTouchStart}
        onTouchEnd={drawing.handlers.onTouchEnd}
        onTouchCancel={drawing.handlers.onTouchCancel}
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
          完成形（答え）
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
