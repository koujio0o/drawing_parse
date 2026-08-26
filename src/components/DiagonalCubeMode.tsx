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

export default function DiagonalCubeMode() {
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
    baseZ: 25,
    onRender: renderScene,
  });

  useZoomControls({
    canvasRef: drawCanvasRef,
    onZoomChange: (z) => cam.setZoomSync(z),
    getZoom: () => cam.sr.current.zoom,
  });

  const gif = useGifExport({ filename: 'diagonal_cube' });

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
    setTimeout(() => window.dispatchEvent(new Event("resize")), 10);

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

    // --- Build Object (Problem) ---
    const objectGroup = new THREE.Group();

    // Cube 1 (Base)
    const cube1Group = new THREE.Group();
    const matA = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.1 });
    cube1Group.add(new THREE.Mesh(geoA, matA));
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    addEdgesToGroup(cube1Group, new THREE.EdgesGeometry(geoA), blackMat);
    
    // Hints for the two 45-degree cubes
    const hintMat = new THREE.MeshBasicMaterial({ color: 0xff9500 }); // Orange for hint
    
    // Hint 1: Right-top edge (+45 deg)
    const hint1Edge = new THREE.Mesh(cylGeo, hintMat);
    hint1Edge.position.set(size / 2, size / 2, 0);
    hint1Edge.scale.set(1.5, 1.5, size); // slightly thicker
    cube1Group.add(hint1Edge);

    const hint1Flap = new THREE.Mesh(cylGeo, hintMat);
    // short line pointing at 45 deg
    const h1Dir = new THREE.Vector3(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4), 0).normalize();
    const h1Len = 1.0;
    hint1Flap.position.copy(new THREE.Vector3(size / 2, size / 2, 0)).addScaledVector(h1Dir, h1Len / 2);
    hint1Flap.scale.set(1.5, 1.5, h1Len);
    hint1Flap.lookAt(new THREE.Vector3(size / 2, size / 2, 0).addScaledVector(h1Dir, h1Len));
    cube1Group.add(hint1Flap);

    // Hint 2: Left-top edge (135 deg / -45 deg from left)
    const hint2Edge = new THREE.Mesh(cylGeo, hintMat);
    hint2Edge.position.set(-size / 2, size / 2, 0);
    hint2Edge.scale.set(1.5, 1.5, size);
    cube1Group.add(hint2Edge);

    const hint2Flap = new THREE.Mesh(cylGeo, hintMat);
    // short line pointing at 135 deg (up and left)
    const h2Dir = new THREE.Vector3(-Math.cos(Math.PI / 4), Math.sin(Math.PI / 4), 0).normalize();
    const h2Len = 1.0;
    hint2Flap.position.copy(new THREE.Vector3(-size / 2, size / 2, 0)).addScaledVector(h2Dir, h2Len / 2);
    hint2Flap.scale.set(1.5, 1.5, h2Len);
    hint2Flap.lookAt(new THREE.Vector3(-size / 2, size / 2, 0).addScaledVector(h2Dir, h2Len));
    cube1Group.add(hint2Flap);

    objectGroup.add(cube1Group);

    // Center the whole object approximately
    objectGroup.position.set(0, -size / 4, 0);

    // Target Group (only lines, faint faces, and hints)
    r.targetGroup.add(objectGroup);

    // --- Track Lines (for answer mode extension) ---
    r.trackGroup = new THREE.Group();
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.3 });
    const L = 100;
    const s = size / 2;
    
    // Add extension lines for cube 1
    for (let y of [-s, s]) {
      for (let z of [-s, s]) { addThickLine(r.trackGroup, new THREE.Vector3(-L, y, z), new THREE.Vector3(L, y, z), trackMat); }
    }
    for (let x of [-s, s]) {
      for (let z of [-s, s]) { addThickLine(r.trackGroup, new THREE.Vector3(x, -L, z), new THREE.Vector3(x, L, z), trackMat); }
    }
    for (let x of [-s, s]) {
      for (let y of [-s, s]) { addThickLine(r.trackGroup, new THREE.Vector3(x, y, -L), new THREE.Vector3(x, y, L), trackMat); }
    }

    // Function to add track lines for a rotated cube
    const addTrackLinesRotated = (pivotX: number, pivotY: number, angleZ: number) => {
      // Cube local points: [-s, s]
      // transform: translate(pivot) * rotZ(angle) * translate(s, s, 0)
      const transform = (v: THREE.Vector3) => {
        v.x += s; v.y += s;
        v.applyAxisAngle(new THREE.Vector3(0,0,1), angleZ);
        v.x += pivotX; v.y += pivotY;
        return v;
      };
      
      for (let y of [-s, s]) {
        for (let z of [-s, s]) {
          addThickLine(r.trackGroup!, transform(new THREE.Vector3(-L, y, z)), transform(new THREE.Vector3(L, y, z)), trackMat);
        }
      }
      for (let x of [-s, s]) {
        for (let z of [-s, s]) {
          addThickLine(r.trackGroup!, transform(new THREE.Vector3(x, -L, z)), transform(new THREE.Vector3(x, L, z)), trackMat);
        }
      }
      for (let x of [-s, s]) {
        for (let y of [-s, s]) {
          addThickLine(r.trackGroup!, transform(new THREE.Vector3(x, y, -L)), transform(new THREE.Vector3(x, y, L)), trackMat);
        }
      }
    };

    // Extension lines for Cube 2 (Right)
    addTrackLinesRotated(s, s, Math.PI / 4);
    // Extension lines for Cube 3 (Left) - angle is 90+45 = 135 deg to rotate the bottom-left edge appropriately?
    // Wait, if pivot is left-top (-s, s), we want the cube to go left and up.
    // A rotation of Math.PI/2 + Math.PI/4 (135 deg) around Z applied to (x+s, y+s) will make it go left-up.
    addTrackLinesRotated(-s, s, Math.PI / 2 + Math.PI / 4);

    // Apply offset for trackGroup as well
    r.trackGroup.position.set(0, -size / 4, 0);

    r.trackGroup.visible = visRef.current.isAnswerVisible;
    r.targetGroup.add(r.trackGroup);

    // --- Answer Group ---
    r.answerGroup = new THREE.Group();
    const answerSolidMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    
    // Answer Cube 1
    const aCube1 = new THREE.Mesh(geoA, answerSolidMat);
    r.answerGroup.add(aCube1);
    addEdgesToGroup(r.answerGroup, new THREE.EdgesGeometry(geoA), redMat);

    // Answer Cube 2
    const aCube2GroupPivot = new THREE.Group();
    aCube2GroupPivot.position.set(size / 2, size / 2, 0);
    const aCube2Group = new THREE.Group();
    aCube2Group.position.set(size / 2, size / 2, 0);
    aCube2Group.add(new THREE.Mesh(geoA, answerSolidMat));
    addEdgesToGroup(aCube2Group, new THREE.EdgesGeometry(geoA), redMat);
    aCube2GroupPivot.add(aCube2Group);
    aCube2GroupPivot.rotation.z = Math.PI / 4;
    r.answerGroup.add(aCube2GroupPivot);

    // Answer Cube 3
    const aCube3GroupPivot = new THREE.Group();
    aCube3GroupPivot.position.set(-size / 2, size / 2, 0);
    const aCube3Group = new THREE.Group();
    aCube3Group.position.set(size / 2, size / 2, 0); // same local offset
    aCube3Group.add(new THREE.Mesh(geoA, answerSolidMat));
    addEdgesToGroup(aCube3Group, new THREE.EdgesGeometry(geoA), redMat);
    aCube3GroupPivot.add(aCube3Group);
    aCube3GroupPivot.rotation.z = Math.PI / 2 + Math.PI / 4; // 135 degrees
    r.answerGroup.add(aCube3GroupPivot);

    r.answerGroup.position.set(0, -size / 4, 0);
    r.answerGroup.visible = visRef.current.isAnswerVisible;
    r.targetGroup.add(r.answerGroup);

    // Grid
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
