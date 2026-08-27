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

export default function SphereMode() {
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
    answerMesh: null as THREE.Group | null,
    ctxGuide: null as CanvasRenderingContext2D | null,
    ctxAnswer: null as CanvasRenderingContext2D | null,
    boxSizes: null as { sx: number, sy: number, sz: number } | null,
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
    baseZ: 20,
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

  const gif = useGifExport({ filename: 'perspective_sphere' });

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
    setTimeout(() => window.dispatchEvent(new Event("resize")), 10);

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
    const sx = size;
    const sy = size;
    const sz = size * 2;
    r.boxSizes = { sx, sy, sz };

    const boxGeo = new THREE.BoxGeometry(sx, sy, sz);
    const boxMat = new THREE.MeshBasicMaterial({ color: 0x007aff, wireframe: true, transparent: true, opacity: 0.1 });
    r.boundingBoxMesh = new THREE.Mesh(boxGeo, boxMat);
    r.targetGroup.add(r.boundingBoxMesh);

    const guideGroup = new THREE.Group();
    const xAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-sx/2, 0, 0), new THREE.Vector3(sx/2, 0, 0)]);
    const yAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -sy/2, 0), new THREE.Vector3(0, sy/2, 0)]);
    const zAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -sz/2), new THREE.Vector3(0, 0, sz/2)]);
    const axisMat = new THREE.LineDashedMaterial({ color: 0x007aff, dashSize: 0.5, gapSize: 0.5, transparent: true, opacity: 0.5 });
    [xAxisGeo, yAxisGeo, zAxisGeo].forEach(geo => {
      const line = new THREE.Line(geo, axisMat);
      line.computeLineDistances();
      guideGroup.add(line);
    });

    const dotGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x007aff });
    const dotPositions = [
      [sx/2, 0, 0], [-sx/2, 0, 0],
      [0, sy/2, 0], [0, -sy/2, 0],
      [0, 0, sz/2], [0, 0, -sz/2]
    ];
    dotPositions.forEach(pos => {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(pos[0], pos[1], pos[2]);
      guideGroup.add(dot);
    });
    r.targetGroup.add(guideGroup);

    const answerGroup = new THREE.Group();
    const solidRedMat = new THREE.LineBasicMaterial({ color: 0xff3b30, linewidth: 2 });
    const dashedRedMat = new THREE.LineDashedMaterial({ color: 0xff3b30, linewidth: 1, dashSize: 0.2, gapSize: 0.2 });
    const dashedBlueMat = new THREE.LineDashedMaterial({ color: 0x007aff, linewidth: 1, dashSize: 0.2, gapSize: 0.2 });

    const createEllipse = (points: THREE.Vector3[], isDashed: boolean, colorStr: string, mat: THREE.Material) => {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, mat);
      if (isDashed) line.computeLineDistances();
      line.userData = { isDashed, color: colorStr };
      answerGroup.add(line);
    };

    const segments = 64;
    
    const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4];
    angles.forEach((phi, idx) => {
      const pts = [];
      const isDashed = (idx === 1 || idx === 3);
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        pts.push(new THREE.Vector3(cosT * Math.cos(phi) * sx/2, cosT * Math.sin(phi) * sy/2, sinT * sz/2));
      }
      createEllipse(pts, isDashed, '#ff3b30', isDashed ? dashedRedMat : solidRedMat);
    });

    const zOffsets = [-sz/4, 0, sz/4];
    zOffsets.forEach((z) => {
      const pts = [];
      const scale = Math.sqrt(1 - Math.pow(z / (sz/2), 2));
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * (sx/2) * scale, Math.sin(theta) * (sy/2) * scale, z));
      }
      createEllipse(pts, true, '#007aff', dashedBlueMat);
    });

    r.answerMesh = answerGroup;
    r.targetGroup.add(r.answerMesh);

    const randRx = Math.floor(Math.random() * 80 - 20);
    const randRy = Math.floor(Math.random() * 180 - 90);
    r.targetGroup.rotation.set(randRx * Math.PI/180, randRy * Math.PI/180, 0);
    r.scene.add(r.targetGroup);

    if (r.gridGroup) r.scene.remove(r.gridGroup);
    r.gridGroup = new THREE.Group();
    const gridColor = 0x007aff;
    const gridXZ = new THREE.GridHelper(100, 25, gridColor, gridColor); gridXZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gridXY = new THREE.GridHelper(100, 25, gridColor, gridColor); gridXY.rotation.x = Math.PI / 2; gridXY.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gridYZ = new THREE.GridHelper(100, 25, gridColor, gridColor); gridYZ.rotation.z = Math.PI / 2; gridYZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
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

  const drawGuide = () => {
    const r = refs.current;
    if (!r.ctxGuide || !r.boundingBoxMesh || !r.camera || !r.targetGroup) return;
    const canvas = guideCanvasRef.current!;

    r.ctxGuide.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    if (visRef.current.isGridVisible && r.gridGroup) {
      r.ctxGuide.strokeStyle = 'rgba(0, 122, 255, 0.15)';
      r.ctxGuide.lineWidth = 1;
      r.gridGroup.children.forEach(grid => {
        const positions = (grid as THREE.LineSegments).geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 6) {
          const v1 = new THREE.Vector3(positions[i], positions[i+1], positions[i+2]).applyMatrix4(grid.matrixWorld).project(r.camera!);
          const v2 = new THREE.Vector3(positions[i+3], positions[i+4], positions[i+5]).applyMatrix4(grid.matrixWorld).project(r.camera!);
          if(v1.z > 1 || v2.z > 1) continue;
          r.ctxGuide!.beginPath();
          r.ctxGuide!.moveTo((v1.x * 0.5 + 0.5) * canvas.clientWidth, (-(v1.y) * 0.5 + 0.5) * canvas.clientHeight);
          r.ctxGuide!.lineTo((v2.x * 0.5 + 0.5) * canvas.clientWidth, (-(v2.y) * 0.5 + 0.5) * canvas.clientHeight);
          r.ctxGuide!.stroke();
        }
      });
    }

    r.ctxGuide.strokeStyle = 'rgba(0, 122, 255, 0.4)'; 
    r.ctxGuide.lineWidth = 2;
    r.ctxGuide.setLineDash([6, 6]); 
    
    const edges = new THREE.EdgesGeometry(r.boundingBoxMesh.geometry);
    const pos = edges.attributes.position.array;
    for (let i = 0; i < pos.length; i += 6) {
      const v1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]).applyMatrix4(r.boundingBoxMesh.matrixWorld).project(r.camera);
      const v2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]).applyMatrix4(r.boundingBoxMesh.matrixWorld).project(r.camera);
      r.ctxGuide.beginPath();
      r.ctxGuide.moveTo((v1.x * 0.5 + 0.5) * canvas.clientWidth, (-(v1.y) * 0.5 + 0.5) * canvas.clientHeight);
      r.ctxGuide.lineTo((v2.x * 0.5 + 0.5) * canvas.clientWidth, (-(v2.y) * 0.5 + 0.5) * canvas.clientHeight);
      r.ctxGuide.stroke();
    }

    const sizes = r.boxSizes;
    if (sizes) {
      const { sx, sy, sz } = sizes;
      const tPoints = [
        new THREE.Vector3(sx/2, 0, 0), new THREE.Vector3(-sx/2, 0, 0),
        new THREE.Vector3(0, sy/2, 0), new THREE.Vector3(0, -sy/2, 0),
        new THREE.Vector3(0, 0, sz/2), new THREE.Vector3(0, 0, -sz/2)
      ];

      r.ctxGuide.setLineDash([4, 4]);
      r.ctxGuide.strokeStyle = 'rgba(0, 122, 255, 0.5)';
      const drawLine = (p1: THREE.Vector3, p2: THREE.Vector3) => {
        const v1 = p1.clone().applyMatrix4(r.targetGroup!.matrixWorld).project(r.camera!);
        const v2 = p2.clone().applyMatrix4(r.targetGroup!.matrixWorld).project(r.camera!);
        if (v1.z > 1 || v2.z > 1) return;
        r.ctxGuide!.beginPath();
        r.ctxGuide!.moveTo((v1.x * 0.5 + 0.5) * canvas.clientWidth, (-(v1.y) * 0.5 + 0.5) * canvas.clientHeight);
        r.ctxGuide!.lineTo((v2.x * 0.5 + 0.5) * canvas.clientWidth, (-(v2.y) * 0.5 + 0.5) * canvas.clientHeight);
        r.ctxGuide!.stroke();
      };
      drawLine(tPoints[0], tPoints[1]);
      drawLine(tPoints[2], tPoints[3]);
      drawLine(tPoints[4], tPoints[5]);

      r.ctxGuide.setLineDash([]);
      r.ctxGuide.fillStyle = 'rgba(0, 122, 255, 0.9)';
      tPoints.forEach(p => {
        const v = p.clone().applyMatrix4(r.targetGroup!.matrixWorld).project(r.camera!);
        if (v.z > 1) return;
        const x = (v.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-(v.y) * 0.5 + 0.5) * canvas.clientHeight;
        r.ctxGuide!.beginPath();
        r.ctxGuide!.arc(x, y, 5, 0, Math.PI * 2);
        r.ctxGuide!.fill();
      });
    } else {
      r.ctxGuide.setLineDash([]);
    }

    let closestDist = Infinity, startPoint: {x:number, y:number} | null = null;
    const posAttr = r.boundingBoxMesh.geometry.attributes.position;
    for(let i=0; i<posAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i).applyMatrix4(r.boundingBoxMesh.matrixWorld);
      const dist = r.camera.position.distanceTo(v);
      v.project(r.camera);
      const x = (v.x * 0.5 + 0.5) * canvas.clientWidth;
      const y = (-(v.y) * 0.5 + 0.5) * canvas.clientHeight;
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
    if (!r.ctxAnswer || !r.answerMesh || !r.camera || !r.targetGroup) return;
    const canvas = answerCanvasRef.current!;

    r.ctxAnswer.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    const children = r.answerMesh.children;
    if (children && children.length > 0) {
      children.forEach((child: any) => {
        if (child.isLine) {
          const isDashed = child.userData.isDashed;
          const colorStr = child.userData.color || '#ff3b30';
          r.ctxAnswer!.strokeStyle = colorStr; 
          r.ctxAnswer!.lineWidth = isDashed ? 1 : 2;
          if (isDashed) {
            r.ctxAnswer!.setLineDash([4, 4]);
          } else {
            r.ctxAnswer!.setLineDash([]);
          }

          const positions = child.geometry.attributes.position;
          r.ctxAnswer!.beginPath();
          for (let i = 0; i < positions.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(positions, i);
            v.applyMatrix4(child.matrixWorld).project(r.camera!);
            if (v.z > 1) continue;
            const x = (v.x * 0.5 + 0.5) * canvas.clientWidth;
            const y = (-(v.y) * 0.5 + 0.5) * canvas.clientHeight;
            if (i === 0) r.ctxAnswer!.moveTo(x, y);
            else r.ctxAnswer!.lineTo(x, y);
          }
          r.ctxAnswer!.stroke();
        }
      });
      r.ctxAnswer!.setLineDash([]);
    }
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
          お題（1:1:2の楕円体）
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
