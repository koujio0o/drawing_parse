import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import useUndoStack from '../hooks/useUndoStack';
import useDrawingCanvas from '../hooks/useDrawingCanvas';
import useZoomControls from '../hooks/useZoomControls';
import usePerspectiveCamera from '../hooks/usePerspectiveCamera';
import useGifExport from '../hooks/useGifExport';
import useCanvasResize from '../hooks/useCanvasResize';
import DrawingToolbar from './DrawingToolbar';
import PerspectiveControls from './PerspectiveControls';

export default function SubtractionMode() {
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
    answerMeshMain: null as THREE.Group | null,
    answerMeshThumb: null as THREE.Group | null,
    boundingBoxMesh: null as THREE.Mesh | null,
  });

  // Synchronous visibility state for render loop
  const visRef = useRef({ isGridVisible: false, isAnswerVisible: false });

  // --- Shared Hooks ---
  const undoStack = useUndoStack({ canvasRef: drawCanvasRef });

  const drawing = useDrawingCanvas({
    canvasRef: drawCanvasRef,
    undoStack,
  });

  const drawGuide = () => {
    const r = refs.current;
    if (!r.boundingBoxMesh || !r.camera) return;
    const canvas = guideCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Guide dashed box
    ctx.strokeStyle = 'rgba(0, 122, 255, 0.5)'; 
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]); 
    
    const edges = new THREE.EdgesGeometry(r.boundingBoxMesh.geometry);
    const pos = edges.attributes.position.array;
    for (let i = 0; i < pos.length; i += 6) {
      const v1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]).applyMatrix4(r.boundingBoxMesh.matrixWorld).project(r.camera);
      const v2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]).applyMatrix4(r.boundingBoxMesh.matrixWorld).project(r.camera);
      if (v1.z > 1 || v2.z > 1) continue;
      ctx.beginPath();
      ctx.moveTo((v1.x * 0.5 + 0.5) * canvas.width, (-(v1.y) * 0.5 + 0.5) * canvas.height);
      ctx.lineTo((v2.x * 0.5 + 0.5) * canvas.width, (-(v2.y) * 0.5 + 0.5) * canvas.height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Closest point
    let closestDist = Infinity, startPoint: {x:number, y:number} | null = null;
    const posAttr = r.boundingBoxMesh.geometry.attributes.position;
    for(let i=0; i<posAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i).applyMatrix4(r.boundingBoxMesh.matrixWorld);
      const dist = r.camera.position.distanceTo(v);
      v.project(r.camera);
      const x = (v.x * 0.5 + 0.5) * canvas.width;
      const y = (-(v.y) * 0.5 + 0.5) * canvas.height;
      if(dist < closestDist) { closestDist = dist; startPoint = {x, y}; }
    }
    if(startPoint) {
      ctx.fillStyle = 'rgba(0, 122, 255, 0.9)';
      ctx.beginPath(); ctx.arc(startPoint.x, startPoint.y, 6, 0, Math.PI*2); ctx.fill();
      ctx.font = 'bold 12px sans-serif'; ctx.fillText('基準角', startPoint.x + 10, startPoint.y + 4);
    }
  };

  const renderScene = () => {
    const r = refs.current;
    if (!r.scene || !r.camera || !r.mainRenderer || !r.thumbnailRenderer || !r.thumbnailCamera || !r.targetGroup) return;

    cam.applyToCamera(r.camera, r.thumbnailCamera);
    cam.applyRotation(r.targetGroup);

    if (r.gridGroup) r.gridGroup.visible = visRef.current.isGridVisible;

    r.scene.updateMatrixWorld(true);

    // Draw Main
    if (r.answerMeshMain) r.answerMeshMain.visible = visRef.current.isAnswerVisible;
    if (r.answerMeshThumb) r.answerMeshThumb.visible = false;
    r.mainRenderer.render(r.scene, r.camera);
    drawGuide();

    // Draw Thumbnail
    if (r.answerMeshMain) r.answerMeshMain.visible = false;
    if (r.answerMeshThumb) r.answerMeshThumb.visible = true;
    r.thumbnailRenderer.render(r.scene, r.thumbnailCamera);

    // Restore visibility
    if (r.answerMeshMain) r.answerMeshMain.visible = visRef.current.isAnswerVisible;
    if (r.answerMeshThumb) r.answerMeshThumb.visible = false;
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

  const gif = useGifExport({ filename: 'perspective_subtraction' });

  useCanvasResize({
    drawCanvasRef,
    ctxRef: undoStack.ctxRef,
    extraCanvasRefs: [guideCanvasRef],
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
    const size = 6;

    const boxGeo = new THREE.BoxGeometry(size, size, size);
    r.boundingBoxMesh = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ visible: false }));
    r.targetGroup.add(r.boundingBoxMesh);

    const shapeType = Math.floor(Math.random() * 8);
    const shape = new THREE.Shape();
    switch(shapeType) {
      case 0: shape.moveTo(-3, -3); shape.lineTo(3, -3); shape.lineTo(3, 1); shape.lineTo(1, 1); shape.lineTo(1, 3); shape.lineTo(-3, 3); shape.lineTo(-3, -3); break;
      case 1: shape.moveTo(-3, -3); shape.lineTo(3, -3); shape.lineTo(3, -1); shape.lineTo(1, -1); shape.lineTo(1, 1); shape.lineTo(-1, 1); shape.lineTo(-1, 3); shape.lineTo(-3, 3); shape.lineTo(-3, -3); break;
      case 2: shape.moveTo(-3, -3); shape.lineTo(3, -3); shape.lineTo(3, 3); shape.lineTo(1, 3); shape.lineTo(1, 1); shape.lineTo(-1, 1); shape.lineTo(-1, 3); shape.lineTo(-3, 3); shape.lineTo(-3, -3); break;
      case 3: shape.moveTo(-3, -3); shape.lineTo(3, -3); shape.lineTo(3, -1); shape.lineTo(1, -1); shape.lineTo(1, 3); shape.lineTo(-1, 3); shape.lineTo(-1, -1); shape.lineTo(-3, -1); shape.lineTo(-3, -3); break;
      case 4: shape.moveTo(-3, -3); shape.lineTo(-1, -3); shape.lineTo(-1, 1); shape.lineTo(1, 1); shape.lineTo(1, -3); shape.lineTo(3, -3); shape.lineTo(3, 3); shape.lineTo(-3, 3); shape.lineTo(-3, -3); break;
      case 5: shape.moveTo(-3, -3); shape.lineTo(3, -3); shape.lineTo(3, 3); shape.lineTo(-3, -3); break;
      case 6: shape.moveTo(-3, -3); shape.lineTo(3, -3); shape.lineTo(3, 3); shape.lineTo(1, 3); shape.lineTo(1, -1); shape.lineTo(-1, -1); shape.lineTo(-1, 3); shape.lineTo(-3, 3); shape.lineTo(-3, -3); break;
      case 7: shape.moveTo(-3, -3); shape.lineTo(1, -3); shape.lineTo(1, 1); shape.lineTo(3, 1); shape.lineTo(3, 3); shape.lineTo(-3, 3); shape.lineTo(-3, -3); break;
    }
    const extrudeSettings = { depth: size, bevelEnabled: false };
    const answerGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    answerGeo.center(); 
    
    r.answerMeshMain = new THREE.Group();
    const answerSolidMatMain = new THREE.MeshBasicMaterial({ color: 0xf5f5f7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    r.answerMeshMain.add(new THREE.Mesh(answerGeo, answerSolidMatMain));
    const answerLineMat = new THREE.LineBasicMaterial({ color: 0xff3b30 });
    r.answerMeshMain.add(new THREE.LineSegments(new THREE.EdgesGeometry(answerGeo), answerLineMat));
    r.answerMeshMain.visible = visRef.current.isAnswerVisible;
    r.targetGroup.add(r.answerMeshMain);

    r.answerMeshThumb = new THREE.Group();
    const answerSolidMatThumb = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    r.answerMeshThumb.add(new THREE.Mesh(answerGeo, answerSolidMatThumb));
    const thumbLineMat = new THREE.LineBasicMaterial({ color: 0x333333 });
    r.answerMeshThumb.add(new THREE.LineSegments(new THREE.EdgesGeometry(answerGeo), thumbLineMat));
    r.answerMeshThumb.visible = false;
    r.targetGroup.add(r.answerMeshThumb);

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

    // Synchronously update state and force a render
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

  // --- GIF capture ---
  const handleExportGif = () => {
    gif.exportGif((withAnswer, exportWidth, exportHeight) => {
      const r = refs.current;
      if (!r.scene || !r.camera || !r.mainRenderer) return '';

      if (r.answerMeshMain) r.answerMeshMain.visible = withAnswer;
      r.mainRenderer.render(r.scene, r.camera);

      const tCanvas = document.createElement('canvas');
      tCanvas.width = exportWidth; tCanvas.height = exportHeight;
      const tCtx = tCanvas.getContext('2d')!;

      tCtx.fillStyle = '#f5f5f7';
      tCtx.fillRect(0, 0, exportWidth, exportHeight);

      tCtx.drawImage(mainCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(guideCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(drawCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      
      // Restore visibility
      if (r.answerMeshMain) r.answerMeshMain.visible = visRef.current.isAnswerVisible;
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
        onClearAll={undoStack.clearAll}
      />

      <div className="glass-panel" style={{ position: 'absolute', top: 20, right: 20, width: 200, height: 200, overflow: 'hidden', zIndex: 20, padding: 0 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: 12, textAlign: 'center', padding: '4px 0', zIndex: 21 }}>
          お題（削り出す完成形）
        </div>
        <canvas ref={thumbnailCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      <DrawingToolbar
        drawing={drawing}
        onUndo={undoStack.performUndo}
        onClearAll={undoStack.clearAll}
        onExportGif={handleExportGif}
        isExporting={gif.isExporting}
      />
    </>
  );
}
