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

export default function SphereContourMode() {
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
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
    answerGroupMain: null as THREE.Group | null,
    answerGroupThumb: null as THREE.Group | null,
  });

  const visRef = useRef({ isGridVisible: false, isAnswerVisible: false });

  // --- Shared Hooks ---
  const undoStack = useUndoStack({ canvasRef: drawCanvasRef });

  const drawing = useDrawingCanvas({
    undoStack,
  });

  const renderScene = () => {
    const r = refs.current;
    if (!r.scene || !r.camera || !r.mainRenderer || !r.thumbnailRenderer || !r.thumbnailCamera || !r.targetGroup) return;

    cam.applyToCamera(r.camera, r.thumbnailCamera);
    cam.applyRotation(r.targetGroup);

    if (r.gridGroup) r.gridGroup.visible = visRef.current.isGridVisible;

    r.scene.updateMatrixWorld(true);

    // Draw Main
    if (r.answerGroupMain) r.answerGroupMain.visible = visRef.current.isAnswerVisible;
    if (r.answerGroupThumb) r.answerGroupThumb.visible = false;
    r.mainRenderer.render(r.scene, r.camera);
    
    // Draw Thumbnail
    if (r.answerGroupMain) r.answerGroupMain.visible = false;
    if (r.answerGroupThumb) r.answerGroupThumb.visible = true;
    r.thumbnailRenderer.render(r.scene, r.thumbnailCamera);

    // Restore visibility state
    if (r.answerGroupMain) r.answerGroupMain.visible = visRef.current.isAnswerVisible;
    if (r.answerGroupThumb) r.answerGroupThumb.visible = false;
  };

  const cam = usePerspectiveCamera({
    baseZ: 12,
    onRender: renderScene,
  });

  useOrbitControls({ canvasRef: drawCanvasRef, cameraHandle: cam });

  const doRedraw = () => {
    const ctx = undoStack.ctxRef.current;
    if (ctx) drawing.redrawAll(ctx, undoStack.getCurrentStrokes());
  };

  useZoomControls({
    canvasRef: drawCanvasRef,
    onZoomChange: (z) => cam.setZoomSync(z),
    getZoom: () => cam.sr.current.zoom,
  });

  const gif = useGifExport({ filename: 'perspective_sphere_contour' });

  useCanvasResize({
    drawCanvasRef,
    extraCanvasRefs: [guideCanvasRef],
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

  const createGreatCircle = (radius: number, axis: THREE.Vector3, color: number, lineWidth: number) => {
    const segments = 64;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultNormal, axis.clone().normalize());
    geo.applyQuaternion(quaternion);

    const group = new THREE.Group();

    // Back line (dashed, ignores depth so it draws over the occluder)
    const backMat = new THREE.LineDashedMaterial({ 
      color, 
      linewidth: 1, 
      dashSize: 0.2, 
      gapSize: 0.2,
      depthTest: false,
      transparent: true,
      opacity: 0.5
    });
    const backLine = new THREE.Line(geo, backMat);
    backLine.computeLineDistances();
    backLine.renderOrder = 1;
    group.add(backLine);

    // Front line (solid, respects depth so it only draws in front of the occluder)
    const frontMat = new THREE.LineBasicMaterial({ 
      color, 
      linewidth: lineWidth,
      depthTest: true
    });
    const frontLine = new THREE.Line(geo, frontMat);
    frontLine.renderOrder = 2;
    group.add(frontLine);

    return group;
  };

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
    const radius = 4;

    // Solid sphere to hide back lines
    const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
    
    // Main mode background sphere (f5f5f7)
    const bgSphereMain = new THREE.Mesh(
      sphereGeo, 
      new THREE.MeshBasicMaterial({ color: 0xf5f5f7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    );
    // Silhouette outline for main sphere
    bgSphereMain.add(new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true, transparent: true, opacity: 0.1 })
    ));
    r.targetGroup.add(bgSphereMain);

    // Orientation type (0 = Horizontal XZ, 1 = Vertical XY, 2 = Vertical YZ)
    const orientationType = Math.floor(Math.random() * 3);
    
    let axisA: THREE.Vector3, axisB: THREE.Vector3, axisC: THREE.Vector3;

    if (orientationType === 0) {
      axisA = new THREE.Vector3(0, 1, 0);
      axisB = new THREE.Vector3(0, 0, 1);
      axisC = new THREE.Vector3(0, 1, 1).normalize();
    } else if (orientationType === 1) {
      axisA = new THREE.Vector3(0, 0, 1);
      axisB = new THREE.Vector3(1, 0, 0);
      axisC = new THREE.Vector3(1, 0, 1).normalize();
    } else {
      axisA = new THREE.Vector3(1, 0, 0);
      axisB = new THREE.Vector3(0, 1, 0);
      axisC = new THREE.Vector3(1, 1, 0).normalize();
    }

    // Always visible circle (a)
    const circleA = createGreatCircle(radius + 0.01, axisA, 0x007aff, 2); // Blue
    r.targetGroup.add(circleA);

    // Intersection dots (poles) as hints
    const dotGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x007aff });
    const polePositions = [
      new THREE.Vector3(radius, 0, 0), new THREE.Vector3(-radius, 0, 0),
      new THREE.Vector3(0, radius, 0), new THREE.Vector3(0, -radius, 0),
      new THREE.Vector3(0, 0, radius), new THREE.Vector3(0, 0, -radius)
    ];
    polePositions.forEach(pos => {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      r.targetGroup!.add(dot);
    });

    // Answer circles (b and c) for Main
    r.answerGroupMain = new THREE.Group();
    let axisD: THREE.Vector3;
    if (orientationType === 0) axisD = new THREE.Vector3(1, 0, 0);
    else if (orientationType === 1) axisD = new THREE.Vector3(0, 1, 0);
    else axisD = new THREE.Vector3(0, 0, 1);
    
    const circleB_Main = createGreatCircle(radius + 0.02, axisB, 0xff3b30, 1); // Red
    const circleD_Main = createGreatCircle(radius + 0.03, axisD, 0xff9500, 1); // Orange (the other perpendicular)
    const circleC_Main = createGreatCircle(radius + 0.04, axisC, 0x34c759, 1); // Green (45 deg)
    
    r.answerGroupMain.add(circleB_Main);
    r.answerGroupMain.add(circleD_Main);
    r.answerGroupMain.add(circleC_Main);
    r.answerGroupMain.visible = visRef.current.isAnswerVisible;
    r.targetGroup.add(r.answerGroupMain);

    // Answer circles (b and c) for Thumb
    r.answerGroupThumb = new THREE.Group();
    const bgSphereThumb = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    );
    r.answerGroupThumb.add(bgSphereThumb);
    r.answerGroupThumb.add(createGreatCircle(radius + 0.01, axisA, 0x333333, 2));
    r.answerGroupThumb.add(createGreatCircle(radius + 0.02, axisB, 0xff3b30, 1));
    r.answerGroupThumb.add(createGreatCircle(radius + 0.03, axisD, 0xff9500, 1));
    r.answerGroupThumb.add(createGreatCircle(radius + 0.04, axisC, 0x34c759, 1));
    r.answerGroupThumb.visible = false;
    r.targetGroup.add(r.answerGroupThumb);

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
    
    // Clear guide canvas
    const gCtx = guideCanvasRef.current?.getContext('2d');
    if (gCtx && guideCanvasRef.current) {
      gCtx.clearRect(0, 0, guideCanvasRef.current.width, guideCanvasRef.current.height);
    }

    undoStack.reset();

    renderScene();
  };

  const handleExportGif = () => {
    gif.exportGif((withAnswer, exportWidth, exportHeight) => {
      const r = refs.current;
      if (!r.scene || !r.camera || !r.mainRenderer) return '';

      if (r.answerGroupMain) r.answerGroupMain.visible = withAnswer;
      r.mainRenderer.render(r.scene, r.camera);

      const tCanvas = document.createElement('canvas');
      tCanvas.width = exportWidth; tCanvas.height = exportHeight;
      const tCtx = tCanvas.getContext('2d')!;

      tCtx.fillStyle = '#f5f5f7';
      tCtx.fillRect(0, 0, exportWidth, exportHeight);

      tCtx.drawImage(mainCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(guideCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(drawCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      
      // Restore
      if (r.answerGroupMain) r.answerGroupMain.visible = visRef.current.isAnswerVisible;
      r.mainRenderer.render(r.scene, r.camera);

      return tCanvas.toDataURL('image/png');
    });
  };

  return (
    <>
      <canvas ref={mainCanvasRef} className="layer-canvas" style={{ zIndex: 4 }} />
      <canvas ref={guideCanvasRef} className="layer-canvas" style={{ zIndex: 5, pointerEvents: 'none' }} />
      <canvas 
        ref={drawCanvasRef} 
        className="layer-canvas" 
        style={{ 
          zIndex: 10, 
          pointerEvents: 'auto', 
          cursor: 'crosshair', 
          touchAction: 'none',
          opacity: isAnswerVisible ? 0.35 : 1,
          transition: 'opacity 0.3s ease'
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
          お題（直角と45度）
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
