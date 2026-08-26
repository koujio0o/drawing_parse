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

const faceDefs = [
  { dir: new THREE.Vector3(1, 0, 0), rot: [0, Math.PI/2, 0] },
  { dir: new THREE.Vector3(-1, 0, 0), rot: [0, -Math.PI/2, 0] },
  { dir: new THREE.Vector3(0, 1, 0), rot: [-Math.PI/2, 0, 0] },
  { dir: new THREE.Vector3(0, -1, 0), rot: [Math.PI/2, 0, 0] },
  { dir: new THREE.Vector3(0, 0, 1), rot: [0, 0, 0] },
  { dir: new THREE.Vector3(0, 0, -1), rot: [0, Math.PI, 0] }
];

export default function CircleMode() {
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const answerCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);

  const refs = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    targetGroup: null as THREE.Group | null,
    gridGroup: null as THREE.Group | null,
    boundingBoxMesh: null as THREE.Mesh | null,
    answerGroup: null as THREE.Group | null,
    ctxGuide: null as CanvasRenderingContext2D | null,
    ctxAnswer: null as CanvasRenderingContext2D | null,
  });

  const visRef = useRef({ isGridVisible: false, isAnswerVisible: false });

  // --- Shared Hooks ---
  const undoStack = useUndoStack({ canvasRef: drawCanvasRef });

  const drawing = useDrawingCanvas({
    undoStack,
  });

  const renderScene = () => {
    const r = refs.current;
    if (!r.camera || !r.scene || !r.renderer || !r.targetGroup) return;

    cam.applyToCamera(r.camera);
    cam.applyRotation(r.targetGroup);

    if (r.gridGroup) r.gridGroup.visible = visRef.current.isGridVisible;

    r.scene.updateMatrixWorld(true);

    // Draw Thumbnail
    r.renderer.render(r.scene, r.camera);

    // Draw 2D
    drawGuide();
    if (visRef.current.isAnswerVisible) {
      drawAnswer();
    } else if (r.ctxAnswer && answerCanvasRef.current) {
      r.ctxAnswer.clearRect(0, 0, answerCanvasRef.current.width, answerCanvasRef.current.height);
    }
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

  const gif = useGifExport({ filename: 'perspective_circle' });

  useCanvasResize({
    drawCanvasRef,
    redrawAll: doRedraw,
    extraCanvasRefs: [guideCanvasRef, answerCanvasRef],
    onResize: (w, h) => {
      const r = refs.current;
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

    const cGuide = guideCanvasRef.current!;
    const cAnswer = answerCanvasRef.current!;
    refs.current.ctxGuide = cGuide.getContext('2d');
    refs.current.ctxAnswer = cAnswer.getContext('2d');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f7);
    const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.lookAt(0, 0, 0);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(200, 200);
    if (thumbnailRef.current) thumbnailRef.current.appendChild(renderer.domElement);
    
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    refs.current.scene = scene;
    refs.current.camera = camera;
    refs.current.renderer = renderer;

    generateRandomBlock();

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      if (renderer.domElement && thumbnailRef.current) thumbnailRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateRandomBlock = () => {
    const r = refs.current;
    if (!r.scene || !r.camera) return;

    if (r.targetGroup) r.scene.remove(r.targetGroup);
    r.targetGroup = new THREE.Group();
    const size = 6; 

    const boxGeo = new THREE.BoxGeometry(size, size, size);
    r.boundingBoxMesh = new THREE.Mesh(boxGeo); 
    r.targetGroup.add(r.boundingBoxMesh);

    const solidBoxMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const solidBoxMesh = new THREE.Mesh(boxGeo, solidBoxMat);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x333333 }));
    solidBoxMesh.add(boxLine);
    r.targetGroup.add(solidBoxMesh);

    const randRx = Math.floor(Math.random() * 80 - 20);
    const randRy = Math.floor(Math.random() * 180 - 90);
    r.targetGroup.rotation.set(randRx * Math.PI/180, randRy * Math.PI/180, 0);
    r.targetGroup.updateMatrixWorld(true);

    r.answerGroup = new THREE.Group();
    const camDir = new THREE.Vector3(0, 0, 1);
    
    const circleMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const circleLineMat = new THREE.LineBasicMaterial({ color: 0xff3b30 });

    faceDefs.forEach((face) => {
      const worldNormal = face.dir.clone().applyEuler(r.targetGroup!.rotation);
      if (worldNormal.dot(camDir) > 0.05) { 
        const circleGeo = new THREE.CircleGeometry(size / 2, 64);
        const circleMesh = new THREE.Mesh(circleGeo, circleMat);
        circleMesh.position.copy(face.dir).multiplyScalar(size / 2 + 0.02);
        circleMesh.rotation.set(face.rot[0], face.rot[1], face.rot[2]);

        const edgePoints = [];
        const innerEdgePoints = [];
        for(let i=0; i<=64; i++){
          const theta = (i/64) * Math.PI * 2;
          edgePoints.push(new THREE.Vector3(Math.cos(theta)*(size/2), Math.sin(theta)*(size/2), 0));
          innerEdgePoints.push(new THREE.Vector3(Math.cos(theta)*(size/4), Math.sin(theta)*(size/4), 0));
        }
        const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
        const line = new THREE.Line(edgeGeo, circleLineMat);
        circleMesh.add(line);

        const innerEdgeGeo = new THREE.BufferGeometry().setFromPoints(innerEdgePoints);
        const innerLine = new THREE.Line(innerEdgeGeo, circleLineMat);
        circleMesh.add(innerLine);

        r.answerGroup!.add(circleMesh);
      }
    });

    solidBoxMesh.add(r.answerGroup); 
    r.scene.add(r.targetGroup);

    if (r.gridGroup) r.scene.remove(r.gridGroup);
    r.gridGroup = new THREE.Group();
    const gridColor = 0x007aff;
    const gridSize = 60;
    const gridDivisions = 20; 
    const gridXZ = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor); 
    gridXZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gridXY = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor); 
    gridXY.rotation.x = Math.PI / 2; 
    gridXY.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gridYZ = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor); 
    gridYZ.rotation.z = Math.PI / 2; 
    gridYZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    r.gridGroup.add(gridXZ, gridXY, gridYZ);
    r.gridGroup.visible = visRef.current.isGridVisible;
    r.targetGroup.add(r.gridGroup);

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

  const drawLine3D = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, p1_world: THREE.Vector3, p2_world: THREE.Vector3) => {
    const r = refs.current;
    if (!r.camera) return;
    const p1 = p1_world.clone().applyMatrix4(r.camera.matrixWorldInverse);
    const p2 = p2_world.clone().applyMatrix4(r.camera.matrixWorldInverse);
    
    const near = r.camera.near;
    if (p1.z > -near && p2.z > -near) return;
    
    let p1_clip = p1.clone();
    let p2_clip = p2.clone();
    
    if (p1.z > -near) {
      const t = (-near - p2.z) / (p1.z - p2.z);
      p1_clip.lerpVectors(p2, p1, t);
    } else if (p2.z > -near) {
      const t = (-near - p1.z) / (p2.z - p1.z);
      p2_clip.lerpVectors(p1, p2, t);
    }
    
    p1_clip.applyMatrix4(r.camera.projectionMatrix);
    p2_clip.applyMatrix4(r.camera.projectionMatrix);
    
    const w = canvas.width;
    const h = canvas.height;
    
    const x1 = (p1_clip.x * 0.5 + 0.5) * w;
    const y1 = (-(p1_clip.y) * 0.5 + 0.5) * h;
    const x2 = (p2_clip.x * 0.5 + 0.5) * w;
    const y2 = (-(p2_clip.y) * 0.5 + 0.5) * h;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawGuide = () => {
    const r = refs.current;
    if (!r.ctxGuide || !r.boundingBoxMesh || !r.camera) return;
    const canvas = guideCanvasRef.current!;

    r.ctxGuide.clearRect(0, 0, canvas.width, canvas.height);

    if (visRef.current.isGridVisible && r.gridGroup) {
      r.ctxGuide.strokeStyle = 'rgba(0, 122, 255, 0.15)';
      r.ctxGuide.lineWidth = 1;
      r.gridGroup.children.forEach(grid => {
        const positions = (grid as THREE.LineSegments).geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 6) {
          const v1 = new THREE.Vector3(positions[i], positions[i+1], positions[i+2]).applyMatrix4(grid.matrixWorld);
          const v2 = new THREE.Vector3(positions[i+3], positions[i+4], positions[i+5]).applyMatrix4(grid.matrixWorld);
          drawLine3D(r.ctxGuide!, canvas, v1, v2);
        }
      });
    }

    r.ctxGuide.strokeStyle = 'rgba(0, 122, 255, 0.4)'; 
    r.ctxGuide.lineWidth = 2;
    r.ctxGuide.setLineDash([6, 6]); 
    
    const edges = new THREE.EdgesGeometry(r.boundingBoxMesh.geometry);
    const pos = edges.attributes.position.array;
    for (let i = 0; i < pos.length; i += 6) {
      const v1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]).applyMatrix4(r.boundingBoxMesh.matrixWorld);
      const v2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]).applyMatrix4(r.boundingBoxMesh.matrixWorld);
      drawLine3D(r.ctxGuide, canvas, v1, v2);
    }
    r.ctxGuide.setLineDash([]);

    let closestDist = Infinity, startPoint: {x:number,y:number} | null = null;
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
      r.ctxGuide.fillStyle = 'rgba(0, 122, 255, 0.8)';
      r.ctxGuide.beginPath(); r.ctxGuide.arc(startPoint.x, startPoint.y, 6, 0, Math.PI*2); r.ctxGuide.fill();
      r.ctxGuide.font = 'bold 12px sans-serif'; r.ctxGuide.fillText('基準角', startPoint.x + 10, startPoint.y + 4);
    }
  };

  const drawAnswer = () => {
    const r = refs.current;
    if (!r.ctxAnswer || !r.answerGroup || !r.camera) return;
    const canvas = answerCanvasRef.current!;

    r.ctxAnswer.clearRect(0, 0, canvas.width, canvas.height);
    r.ctxAnswer.strokeStyle = '#ff3b30'; 
    r.ctxAnswer.lineWidth = 3;

    const size = 6;
    const segments = 64;

    r.answerGroup.children.forEach(circleMesh => {
      // Draw outer circle
      r.ctxAnswer!.beginPath();
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * (size / 2);
        const y = Math.sin(theta) * (size / 2);
        const z = 0;
        
        const v = new THREE.Vector3(x, y, z);
        v.applyMatrix4(circleMesh.matrixWorld); 
        v.project(r.camera!); 
        
        const px = (v.x * 0.5 + 0.5) * canvas.width;
        const py = (-(v.y) * 0.5 + 0.5) * canvas.height;
        
        if (i === 0) r.ctxAnswer!.moveTo(px, py);
        else r.ctxAnswer!.lineTo(px, py);
      }
      r.ctxAnswer!.stroke();

      // Draw inner circle
      r.ctxAnswer!.beginPath();
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * (size / 4);
        const y = Math.sin(theta) * (size / 4);
        const z = 0;
        
        const v = new THREE.Vector3(x, y, z);
        v.applyMatrix4(circleMesh.matrixWorld); 
        v.project(r.camera!); 
        
        const px = (v.x * 0.5 + 0.5) * canvas.width;
        const py = (-(v.y) * 0.5 + 0.5) * canvas.height;
        
        if (i === 0) r.ctxAnswer!.moveTo(px, py);
        else r.ctxAnswer!.lineTo(px, py);
      }
      r.ctxAnswer!.stroke();
    });
  };

  const handleExportGif = () => {
    gif.exportGif((withAnswer, exportWidth, exportHeight) => {
      const r = refs.current;
      if (!r.scene || !r.camera || !r.renderer) return '';
      
      const tCanvas = document.createElement('canvas');
      tCanvas.width = exportWidth; tCanvas.height = exportHeight;
      const tCtx = tCanvas.getContext('2d')!;

      tCtx.fillStyle = '#f5f5f7';
      tCtx.fillRect(0, 0, exportWidth, exportHeight);

      tCtx.drawImage(guideCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(drawCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      
      if (withAnswer) {
        if (!visRef.current.isAnswerVisible) drawAnswer(); 
        tCtx.drawImage(answerCanvasRef.current!, 0, 0, exportWidth, exportHeight);
        if (!visRef.current.isAnswerVisible && r.ctxAnswer) r.ctxAnswer.clearRect(0, 0, answerCanvasRef.current!.width, answerCanvasRef.current!.height); 
      }
      return tCanvas.toDataURL('image/png');
    });
  };

  return (
    <>
      <canvas ref={guideCanvasRef} className="layer-canvas" style={{ zIndex: 5 }} />
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
      <canvas ref={answerCanvasRef} className="layer-canvas" style={{ zIndex: 15 }} />

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
          お題（面に内接する円）
        </div>
        <div ref={thumbnailRef} style={{ width: '100%', height: '100%' }}></div>
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
