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

export default function RatioCuboidMode() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [modeType, setModeType] = useState<'random' | 'two_same'>('random');
  
  const [answerRatio, setAnswerRatio] = useState({ x: 1, y: 1, z: 1 });
  const [userRatio, setUserRatio] = useState({ x: 1, y: 1, z: 1 });

  const sr = useRef({ 
    modeType: 'random',
    trueX: 1, trueY: 1, trueZ: 1,
    userX: 1, userY: 1, userZ: 1
  });

  const refs = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    thumbnailCamera: null as THREE.PerspectiveCamera | null,
    mainRenderer: null as THREE.WebGLRenderer | null,
    thumbnailRenderer: null as THREE.WebGLRenderer | null,
    targetGroup: null as THREE.Group | null,
    gridGroup: null as THREE.Group | null,
    answerGroup: null as THREE.Group | null,
    userGroup: null as THREE.Group | null,
  });

  const visRef = useRef({ isGridVisible: false, isAnswerVisible: false });

  // --- Shared Hooks ---
  const undoStack = useUndoStack({ canvasRef: drawCanvasRef });

  const drawing = useDrawingCanvas({
    undoStack,
    palette: COLORS,
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

    if (r.answerGroup) r.answerGroup.visible = visRef.current.isAnswerVisible;
    if (r.userGroup) r.userGroup.visible = visRef.current.isAnswerVisible;

    r.mainRenderer.render(r.scene, r.camera);

    // Thumbnail always shows overlay
    if (r.answerGroup) r.answerGroup.visible = true;
    if (r.userGroup) r.userGroup.visible = true;
    r.thumbnailRenderer.render(r.scene, r.thumbnailCamera);

    // Restore
    if (r.answerGroup) r.answerGroup.visible = visRef.current.isAnswerVisible;
    if (r.userGroup) r.userGroup.visible = visRef.current.isAnswerVisible;
  };

  const cam = usePerspectiveCamera({
    baseZ: 35,
    initialFov: 50,
    fovRange: [30, 120],
    onRender: renderScene,
  });

  useZoomControls({
    canvasRef: drawCanvasRef,
    onZoomChange: (z) => cam.setZoomSync(z),
    getZoom: () => cam.sr.current.zoom,
  });

  const gif = useGifExport({ filename: 'ratio_cuboid' });

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

  useOrbitControls({ canvasRef: drawCanvasRef, cameraHandle: cam });

  const setGridSync = (v: boolean) => { visRef.current.isGridVisible = v; setIsGridVisible(v); renderScene(); };
  const setAnswerSync = (v: boolean) => { visRef.current.isAnswerVisible = v; setIsAnswerVisible(v); renderScene(); };

  useEffect(() => {
    sr.current.modeType = modeType;
    generateRandomBlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeType]);

  useEffect(() => {
    const onContextMenu = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu, { passive: false });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f7);
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.lookAt(0, 0, 0);
    
    const thumbnailCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    thumbnailCamera.lookAt(0, 0, 0);

    const mainRenderer = new THREE.WebGLRenderer({ canvas: mainCanvasRef.current!, antialias: true });
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

  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  cylGeo.rotateX(Math.PI / 2);
  const addThickLine = (group: THREE.Group, p1: THREE.Vector3, p2: THREE.Vector3, mat: THREE.Material, radius: number) => {
    const dist = p1.distanceTo(p2);
    if (dist < 0.01) return;
    const mesh = new THREE.Mesh(cylGeo, mat);
    mesh.position.copy(p1).lerp(p2, 0.5);
    mesh.scale.set(radius, radius, dist);
    mesh.lookAt(p2);
    group.add(mesh);
  };

  const updateUserGroup = () => {
    const r = refs.current;
    if (!r.targetGroup) return;

    if (r.userGroup) {
      r.userGroup.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        }
      });
      r.targetGroup.remove(r.userGroup);
    }
    r.userGroup = new THREE.Group();

    const trueX = sr.current.trueX;
    const trueY = sr.current.trueY;
    const trueZ = sr.current.trueZ;
    const maxDim = Math.max(trueX, trueY, trueZ);
    const unitSize = 10 / maxDim;

    const origW = trueX * unitSize;
    const origH = trueY * unitSize;
    const origD = trueZ * unitSize;

    const ux = sr.current.userX * unitSize;
    const uy = sr.current.userY * unitSize;
    const uz = sr.current.userZ * unitSize;

    const geo = new THREE.BoxGeometry(ux, uy, uz);
    const faceMat = new THREE.MeshBasicMaterial({ color: 0x81c784, transparent: true, opacity: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, faceMat);
    
    mesh.position.set((ux - origW) / 2, (uy - origH) / 2, (uz - origD) / 2);
    r.userGroup.add(mesh);

    const edges = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x388e3c });
    const pos = edges.attributes.position.array;
    for (let i = 0; i < pos.length; i += 6) {
      const p1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]);
      const p2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]);
      p1.add(mesh.position);
      p2.add(mesh.position);
      addThickLine(r.userGroup, p1, p2, edgeMat, 0.06);
    }

    r.userGroup.visible = visRef.current.isAnswerVisible;
    r.targetGroup.add(r.userGroup);

    renderScene();
  };

  useEffect(() => {
    sr.current.userX = userRatio.x;
    sr.current.userY = userRatio.y;
    sr.current.userZ = userRatio.z;
    updateUserGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRatio]);

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

    const getRandomSizeCuboid = () => {
      const steps = [1, 1.5, 2, 2.5, 3, 3.5, 4];
      return steps[Math.floor(Math.random() * steps.length)];
    };

    let x = 1, y = 1, z = 1;
    if (sr.current.modeType === 'random') {
      x = getRandomSizeCuboid();
      y = getRandomSizeCuboid();
      z = getRandomSizeCuboid();
      if (x !== 1 && y !== 1 && z !== 1) {
        const idx = Math.floor(Math.random() * 3);
        if (idx === 0) x = 1; else if (idx === 1) y = 1; else z = 1;
      }
    } else {
      const s1 = getRandomSizeCuboid();
      let s2 = getRandomSizeCuboid();
      while (s2 === s1) { s2 = getRandomSizeCuboid(); }
      const vals = [s1, s1, s2].sort(() => Math.random() - 0.5);
      x = vals[0];
      y = vals[1];
      z = vals[2];
      if (x !== 1 && y !== 1 && z !== 1) {
        if (Math.random() > 0.5) {
          if (x === y) { x = 1; y = 1; }
          else if (y === z) { y = 1; z = 1; }
          else { x = 1; z = 1; }
        } else {
          if (x === y) z = 1;
          else if (y === z) x = 1;
          else y = 1;
        }
      }
    }

    sr.current.trueX = x;
    sr.current.trueY = y;
    sr.current.trueZ = z;
    setAnswerRatio({ x, y, z });
    setUserRatio({ x, y, z });

    const maxDim = Math.max(x, y, z);
    const unitSize = 10 / maxDim;
    const w = x * unitSize;
    const h = y * unitSize;
    const d = z * unitSize;

    const geo = new THREE.BoxGeometry(w, h, d);
    const matA = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.1 });
    const cube = new THREE.Mesh(geo, matA);
    r.targetGroup.add(cube);

    const blackMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const frameOneMat = new THREE.MeshBasicMaterial({ color: 0xab47bc });
    const edges = new THREE.EdgesGeometry(geo);
    
    const pos = edges.attributes.position.array;
    for (let i = 0; i < pos.length; i += 6) {
      const p1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]);
      const p2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]);
      
      const dist = p1.distanceTo(p2);
      if (Math.abs(dist - unitSize) < 0.1) {
        addThickLine(r.targetGroup, p1, p2, frameOneMat, 0.08);
      } else {
        addThickLine(r.targetGroup, p1, p2, blackMat, 0.04);
      }
    }

    // --- Answer Group ---
    r.answerGroup = new THREE.Group();
    const answerSolidMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const aCube = new THREE.Mesh(geo, answerSolidMat);
    r.answerGroup.add(aCube);
    
    const gridInnerMat = new THREE.MeshBasicMaterial({ color: 0x64b5f6 });
    
    for (let ix = 0; ix <= x; ix++) {
      const px = -w/2 + ix * unitSize;
      addThickLine(r.answerGroup, new THREE.Vector3(px, -h/2, d/2), new THREE.Vector3(px, h/2, d/2), gridInnerMat, 0.03);
      addThickLine(r.answerGroup, new THREE.Vector3(px, -h/2, -d/2), new THREE.Vector3(px, h/2, -d/2), gridInnerMat, 0.03);
      addThickLine(r.answerGroup, new THREE.Vector3(px, h/2, -d/2), new THREE.Vector3(px, h/2, d/2), gridInnerMat, 0.03);
      addThickLine(r.answerGroup, new THREE.Vector3(px, -h/2, -d/2), new THREE.Vector3(px, -h/2, d/2), gridInnerMat, 0.03);
    }
    for (let iy = 0; iy <= y; iy++) {
      const py = -h/2 + iy * unitSize;
      addThickLine(r.answerGroup, new THREE.Vector3(-w/2, py, d/2), new THREE.Vector3(w/2, py, d/2), gridInnerMat, 0.03);
      addThickLine(r.answerGroup, new THREE.Vector3(-w/2, py, -d/2), new THREE.Vector3(w/2, py, -d/2), gridInnerMat, 0.03);
      addThickLine(r.answerGroup, new THREE.Vector3(w/2, py, -d/2), new THREE.Vector3(w/2, py, d/2), gridInnerMat, 0.03);
      addThickLine(r.answerGroup, new THREE.Vector3(-w/2, py, -d/2), new THREE.Vector3(-w/2, py, d/2), gridInnerMat, 0.03);
    }
    for (let iz = 0; iz <= z; iz++) {
      const pz = -d/2 + iz * unitSize;
      addThickLine(r.answerGroup, new THREE.Vector3(-w/2, -h/2, pz), new THREE.Vector3(w/2, -h/2, pz), gridInnerMat, 0.03);
      addThickLine(r.answerGroup, new THREE.Vector3(-w/2, h/2, pz), new THREE.Vector3(w/2, h/2, pz), gridInnerMat, 0.03);
      addThickLine(r.answerGroup, new THREE.Vector3(w/2, -h/2, pz), new THREE.Vector3(w/2, h/2, pz), gridInnerMat, 0.03);
      addThickLine(r.answerGroup, new THREE.Vector3(-w/2, -h/2, pz), new THREE.Vector3(-w/2, h/2, pz), gridInnerMat, 0.03);
    }

    r.answerGroup.visible = visRef.current.isAnswerVisible;
    r.targetGroup.add(r.answerGroup);

    sr.current.userX = x;
    sr.current.userY = y;
    sr.current.userZ = z;
    updateUserGroup();

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

    cam.setRxSync(randRx);
    cam.setRySync(randRy);
    cam.setZoomSync(1.0);
    if (visRef.current.isAnswerVisible) {
      visRef.current.isAnswerVisible = false;
      setIsAnswerVisible(false);
    }

    const ctx = undoStack.ctxRef.current;
    if (ctx && drawCanvasRef.current) {
      ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
    }
    undoStack.reset();

    renderScene();
  };

  const handleExportGif = () => {
    gif.exportGif((withAnswer, exportWidth, exportHeight) => {
      const r = refs.current;
      if (!r.scene || !r.camera || !r.mainRenderer) return '';

      if (r.answerGroup) r.answerGroup.visible = withAnswer;
      if (r.userGroup) r.userGroup.visible = withAnswer;
      r.mainRenderer.render(r.scene, r.camera);

      const tCanvas = document.createElement('canvas');
      tCanvas.width = exportWidth; tCanvas.height = exportHeight;
      const tCtx = tCanvas.getContext('2d')!;

      tCtx.fillStyle = '#f5f5f7';
      tCtx.fillRect(0, 0, exportWidth, exportHeight);
      tCtx.drawImage(mainCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(drawCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      
      if (r.answerGroup) r.answerGroup.visible = visRef.current.isAnswerVisible;
      if (r.userGroup) r.userGroup.visible = visRef.current.isAnswerVisible;
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
        fovRange={cam.fovRange}
        onFovChange={cam.setFovSync}
        onRxChange={cam.setRxSync}
        onRyChange={cam.setRySync}
        isGridVisible={isGridVisible}
        onGridToggle={() => setGridSync(!isGridVisible)}
        isAnswerVisible={isAnswerVisible}
        onAnswerToggle={() => setAnswerSync(!isAnswerVisible)}
        onNextQuestion={generateRandomBlock}
        onClearAll={() => undoStack.clearAll(doRedraw)}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block', marginBottom: 4 }}>問題タイプ</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button 
              className={`glass-button ${modeType === 'random' ? 'btn-primary' : 'btn-light'}`}
              style={{ flex: 1, padding: '4px 0', fontSize: 12 }}
              onClick={() => setModeType('random')}
            >
              3辺ランダム
            </button>
            <button 
              className={`glass-button ${modeType === 'two_same' ? 'btn-primary' : 'btn-light'}`}
              style={{ flex: 1, padding: '4px 0', fontSize: 12 }}
              onClick={() => setModeType('two_same')}
            >
              2辺同じ
            </button>
          </div>
        </div>
      </PerspectiveControls>

      {isAnswerVisible && (
        <div style={{
          position: 'absolute',
          top: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          background: 'rgba(255,255,255,0.95)',
          padding: '16px 32px',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#111' }}>
            正解: {answerRatio.x} : {answerRatio.y} : {answerRatio.z}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #ccc', paddingTop: '12px', width: '100%', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#388e3c' }}>予想(緑):</span>
            <input 
              type="number" step="0.5" min="0.5" value={userRatio.x} 
              onChange={e => setUserRatio(p => ({...p, x: Number(e.target.value)}))} 
              style={{ width: '60px', padding: '4px', fontSize: '16px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
            <span style={{ fontWeight: 'bold' }}>:</span>
            <input 
              type="number" step="0.5" min="0.5" value={userRatio.y} 
              onChange={e => setUserRatio(p => ({...p, y: Number(e.target.value)}))} 
              style={{ width: '60px', padding: '4px', fontSize: '16px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
            <span style={{ fontWeight: 'bold' }}>:</span>
            <input 
              type="number" step="0.5" min="0.5" value={userRatio.z} 
              onChange={e => setUserRatio(p => ({...p, z: Number(e.target.value)}))} 
              style={{ width: '60px', padding: '4px', fontSize: '16px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
          </div>
        </div>
      )}

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
