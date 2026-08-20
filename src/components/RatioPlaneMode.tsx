import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gifshot from 'gifshot';

const COLORS = ['#607d8b', '#ab47bc', '#81c784', '#64b5f6', '#111111'];

export default function RatioPlaneMode() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0]);
  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [modeType, setModeType] = useState<'rectangle' | 'triangle'>('rectangle');

  const [answerRatio, setAnswerRatio] = useState({ x: 1, y: 1 });
  const [userRatio, setUserRatio] = useState({ x: 1, y: 1 });

  const sr = useRef({ 
    zoom: 1.0, isGridVisible: false, isAnswerVisible: false, modeType: 'rectangle', 
    currentAngle: 45, trueX: 1, trueY: 1, userX: 1, userY: 1 
  });

  const refs = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.OrthographicCamera | null,
    mainRenderer: null as THREE.WebGLRenderer | null,
    targetGroup: null as THREE.Group | null,
    gridGroup: null as THREE.Group | null,
    answerGroup: null as THREE.Group | null,
    userGroup: null as THREE.Group | null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    initialPinchDist: null as number | null,
    initialZoom: 1.0,
    undoStack: [] as ImageData[],
    ctxDraw: null as CanvasRenderingContext2D | null,
  });

  const renderScene = () => {
    const r = refs.current;
    if (!r.scene || !r.camera || !r.mainRenderer || !r.targetGroup) return;
    
    const state = sr.current;

    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 30 / state.zoom;
    r.camera.left = -aspect * viewSize / 2;
    r.camera.right = aspect * viewSize / 2;
    r.camera.top = viewSize / 2;
    r.camera.bottom = -viewSize / 2;
    r.camera.updateProjectionMatrix();

    if (r.gridGroup) r.gridGroup.visible = state.isGridVisible;

    r.scene.updateMatrixWorld(true);

    if (r.answerGroup) r.answerGroup.visible = state.isAnswerVisible;
    if (r.userGroup) r.userGroup.visible = state.isAnswerVisible;
    
    r.mainRenderer.render(r.scene, r.camera);
  };

  const setZoomSync = (v: number | ((z: number) => number)) => {
    const newZ = typeof v === 'function' ? v(sr.current.zoom) : v;
    sr.current.zoom = newZ; renderScene();
  };
  const setGridSync = (v: boolean) => { sr.current.isGridVisible = v; setIsGridVisible(v); renderScene(); };
  const setAnswerSync = (v: boolean) => { sr.current.isAnswerVisible = v; setIsAnswerVisible(v); renderScene(); };

  useEffect(() => {
    sr.current.modeType = modeType;
    generateRandomBlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeType]);

  useEffect(() => {
    const onContextMenu = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu, { passive: false });

    const cDraw = drawCanvasRef.current!;
    refs.current.ctxDraw = cDraw.getContext('2d');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f7);
    
    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 30;
    const camera = new THREE.OrthographicCamera(-aspect * viewSize / 2, aspect * viewSize / 2, viewSize / 2, -viewSize / 2, 0.1, 500);
    camera.position.z = 10;
    camera.lookAt(0, 0, 0);

    const mainRenderer = new THREE.WebGLRenderer({ canvas: mainCanvasRef.current!, antialias: true, preserveDrawingBuffer: true });
    mainRenderer.setPixelRatio(window.devicePixelRatio);
    
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    refs.current.scene = scene;
    refs.current.camera = camera;
    refs.current.mainRenderer = mainRenderer;

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const r = refs.current;
      const tempImageData = r.undoStack.length > 0 && r.ctxDraw ? r.ctxDraw.getImageData(0, 0, cDraw.width, cDraw.height) : null;
      
      cDraw.width = w; cDraw.height = h;
      mainRenderer.setSize(w, h);
      
      if (r.ctxDraw) {
        r.ctxDraw.lineCap = 'round';
        r.ctxDraw.lineJoin = 'round';
        if (tempImageData) r.ctxDraw.putImageData(tempImageData, 0, 0);
      }
      
      renderScene();
    };
    window.addEventListener('resize', onResize);
    onResize();

    generateRandomBlock();

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
      mainRenderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createTextSprite = (text: string, color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 128);
    
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(10, 5, 1);
    return sprite;
  };

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
    if (sr.current.modeType !== 'rectangle') return;
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

    const maxDim = Math.max(sr.current.trueX, sr.current.trueY);
    const unitSize = 20 / maxDim;
    
    const origW = sr.current.trueX * unitSize;
    const origH = sr.current.trueY * unitSize;

    const w = sr.current.userX * unitSize;
    const h = sr.current.userY * unitSize;

    const geo = new THREE.PlaneGeometry(w, h);
    const faceMat = new THREE.MeshBasicMaterial({ color: 0x81c784, transparent: true, opacity: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, faceMat);
    mesh.position.set((w - origW) / 2, (h - origH) / 2, 0);
    r.userGroup.add(mesh);

    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x388e3c });
    const p1 = new THREE.Vector3(-w/2, -h/2, 0).add(mesh.position);
    const p2 = new THREE.Vector3(w/2, -h/2, 0).add(mesh.position);
    const p3 = new THREE.Vector3(w/2, h/2, 0).add(mesh.position);
    const p4 = new THREE.Vector3(-w/2, h/2, 0).add(mesh.position);
    
    addThickLine(r.userGroup, p1, p2, edgeMat, 0.1);
    addThickLine(r.userGroup, p2, p3, edgeMat, 0.1);
    addThickLine(r.userGroup, p3, p4, edgeMat, 0.1);
    addThickLine(r.userGroup, p4, p1, edgeMat, 0.1);

    r.userGroup.visible = sr.current.isAnswerVisible;
    r.targetGroup.add(r.userGroup);

    renderScene();
  };

  useEffect(() => {
    sr.current.userX = userRatio.x;
    sr.current.userY = userRatio.y;
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
    r.answerGroup = new THREE.Group();

    const blackMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const frameOneMat = new THREE.MeshBasicMaterial({ color: 0xab47bc }); // Purple
    const faceMat = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.1, side: THREE.DoubleSide });

    if (sr.current.modeType === 'rectangle') {
      const getRandomSizePlane = () => {
        const val = 1.0 + Math.floor(Math.random() * 31) * 0.1; 
        return Math.round(val * 10) / 10;
      };

      let x = getRandomSizePlane();
      let y = getRandomSizePlane();
      if (x !== 1 && y !== 1) {
        if (Math.random() > 0.5) x = 1; else y = 1;
      }
      
      sr.current.trueX = x;
      sr.current.trueY = y;
      setAnswerRatio({ x, y });
      setUserRatio({ x, y });

      const maxDim = Math.max(x, y);
      const unitSize = 20 / maxDim;
      
      const w = x * unitSize;
      const h = y * unitSize;

      const geo = new THREE.PlaneGeometry(w, h);
      const plane = new THREE.Mesh(geo, faceMat);
      r.targetGroup.add(plane);

      const p1 = new THREE.Vector3(-w/2, -h/2, 0);
      const p2 = new THREE.Vector3(w/2, -h/2, 0);
      const p3 = new THREE.Vector3(w/2, h/2, 0);
      const p4 = new THREE.Vector3(-w/2, h/2, 0);

      const randomZ = (Math.random() - 0.5) * Math.PI;
      r.targetGroup.rotation.z = randomZ;

      const isX1 = x === 1;
      const isY1 = y === 1;

      addThickLine(r.targetGroup, p1, p2, isX1 ? frameOneMat : blackMat, isX1 ? 0.16 : 0.08);
      addThickLine(r.targetGroup, p2, p3, isY1 ? frameOneMat : blackMat, isY1 ? 0.16 : 0.08);
      addThickLine(r.targetGroup, p3, p4, isX1 ? frameOneMat : blackMat, isX1 ? 0.16 : 0.08);
      addThickLine(r.targetGroup, p4, p1, isY1 ? frameOneMat : blackMat, isY1 ? 0.16 : 0.08);

      const gridInnerMat = new THREE.MeshBasicMaterial({ color: 0x64b5f6 }); // Light blue

      for (let ix = 0; ix <= x; ix++) {
        const px = -w/2 + ix * unitSize;
        addThickLine(r.answerGroup, new THREE.Vector3(px, -h/2, 0.1), new THREE.Vector3(px, h/2, 0.1), gridInnerMat, 0.06);
      }
      for (let iy = 0; iy <= y; iy++) {
        const py = -h/2 + iy * unitSize;
        addThickLine(r.answerGroup, new THREE.Vector3(-w/2, py, 0.1), new THREE.Vector3(w/2, py, 0.1), gridInnerMat, 0.06);
      }

      updateUserGroup();

    } else {
      const angles = [30, 45, 60];
      const theta = angles[Math.floor(Math.random() * angles.length)];
      sr.current.currentAngle = theta;
      const angle2 = 90 - theta;
      
      const base = 20;
      const height = base * Math.tan(theta * Math.PI / 180);
      
      const maxDim = Math.max(base, height);
      const scale = 20 / maxDim;
      const sBase = base * scale;
      const sHeight = height * scale;

      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(sBase, 0);
      shape.lineTo(0, sHeight);
      shape.lineTo(0, 0);

      const geo = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.Mesh(geo, faceMat);
      
      mesh.position.set(-sBase/2, -sHeight/2, 0);
      
      const triGroup = new THREE.Group();
      triGroup.add(mesh);

      const p1 = new THREE.Vector3(-sBase/2, -sHeight/2, 0);
      const p2 = new THREE.Vector3(sBase/2, -sHeight/2, 0);
      const p3 = new THREE.Vector3(-sBase/2, sHeight/2, 0);
      
      addThickLine(triGroup, p1, p2, blackMat, 0.08);
      addThickLine(triGroup, p2, p3, blackMat, 0.08);
      addThickLine(triGroup, p3, p1, blackMat, 0.08);

      const size = 1.5;
      addThickLine(triGroup, new THREE.Vector3(p1.x + size, p1.y, 0), new THREE.Vector3(p1.x + size, p1.y + size, 0), blackMat, 0.05);
      addThickLine(triGroup, new THREE.Vector3(p1.x + size, p1.y + size, 0), new THREE.Vector3(p1.x, p1.y + size, 0), blackMat, 0.05);

      r.targetGroup.add(triGroup);
      r.targetGroup.rotation.z = Math.random() * Math.PI * 2;

      const sprite1 = createTextSprite(`${theta}°`, '#ab47bc');
      sprite1.position.set(p2.x - 3, p2.y + 1.5, 0.1);
      r.answerGroup.add(sprite1);

      const sprite2 = createTextSprite(`${angle2}°`, '#64b5f6');
      sprite2.position.set(p3.x + 2, p3.y - 3, 0.1);
      r.answerGroup.add(sprite2);
    }

    r.answerGroup.visible = sr.current.isAnswerVisible;
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
    const gridXY = new THREE.GridHelper(100, 25, gridColor, gridColor); 
    gridXY.rotation.x = Math.PI / 2; 
    gridXY.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    r.gridGroup.add(gridXY);
    r.gridGroup.visible = sr.current.isGridVisible;
    r.targetGroup.add(r.gridGroup);

    r.scene.add(r.targetGroup);

    sr.current.zoom = 1.0;
    if (sr.current.isAnswerVisible) {
      sr.current.isAnswerVisible = false;
      setIsAnswerVisible(false);
    }

    if (r.ctxDraw && drawCanvasRef.current) {
      r.ctxDraw.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
    }
    r.undoStack = []; 

    renderScene();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;
    const r = refs.current;
    if (!r.ctxDraw) return;
    
    r.undoStack.push(r.ctxDraw.getImageData(0, 0, drawCanvasRef.current!.width, drawCanvasRef.current!.height));
    if (r.undoStack.length > 20) r.undoStack.shift();

    r.isDrawing = true; 
    r.lastX = e.clientX; 
    r.lastY = e.clientY;
    
    r.ctxDraw.beginPath();
    r.ctxDraw.arc(e.clientX, e.clientY, 1.5, 0, Math.PI * 2);
    r.ctxDraw.fillStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : currentColor;
    if (currentTool === 'eraser') r.ctxDraw.globalCompositeOperation = 'destination-out';
    else r.ctxDraw.globalCompositeOperation = 'source-over';
    r.ctxDraw.fill();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const r = refs.current;
    if (!r.isDrawing || !r.ctxDraw) return;
    if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;
    
    r.ctxDraw.beginPath();
    r.ctxDraw.moveTo(r.lastX, r.lastY);
    r.ctxDraw.lineTo(e.clientX, e.clientY);

    if (currentTool === 'eraser') {
      r.ctxDraw.globalCompositeOperation = 'destination-out';
      r.ctxDraw.lineWidth = 60;
      r.ctxDraw.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      r.ctxDraw.globalCompositeOperation = 'source-over';
      r.ctxDraw.lineWidth = 3;
      r.ctxDraw.strokeStyle = currentColor;
    }
    
    r.ctxDraw.stroke();
    r.lastX = e.clientX; 
    r.lastY = e.clientY;
  };

  const handlePointerUp = () => { refs.current.isDrawing = false; };

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        refs.current.initialPinchDist = Math.sqrt(dx * dx + dy * dy);
        refs.current.initialZoom = sr.current.zoom;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && refs.current.initialPinchDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = dist / refs.current.initialPinchDist;
        setZoomSync(Math.max(0.1, Math.min(5.0, refs.current.initialZoom * scale)));
      }
    };

    const onTouchEnd = () => { refs.current.initialPinchDist = null; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomSync(z => Math.max(0.1, Math.min(5.0, z - e.deltaY * 0.005)));
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  const performUndo = () => {
    const r = refs.current;
    if (!r.ctxDraw) return;
    if (r.undoStack.length > 0) {
      r.ctxDraw.putImageData(r.undoStack.pop()!, 0, 0);
    } else {
      r.ctxDraw.clearRect(0, 0, drawCanvasRef.current!.width, drawCanvasRef.current!.height);
    }
  };

  const handleExportGif = () => {
    const r = refs.current;
    if (!r.scene || !r.camera || !r.mainRenderer || isExporting) return;
    
    setIsExporting(true);
    const scale = Math.min(1, 800 / window.innerWidth);
    const exportWidth = window.innerWidth * scale;
    const exportHeight = window.innerHeight * scale;

    const captureFrame = (withAnswer: boolean) => {
      if (r.answerGroup) r.answerGroup.visible = withAnswer;
      if (r.userGroup) r.userGroup.visible = withAnswer;
      r.mainRenderer!.render(r.scene!, r.camera!);

      const tCanvas = document.createElement('canvas');
      tCanvas.width = exportWidth; tCanvas.height = exportHeight;
      const tCtx = tCanvas.getContext('2d')!;

      tCtx.fillStyle = '#f5f5f7';
      tCtx.fillRect(0, 0, exportWidth, exportHeight);

      tCtx.drawImage(mainCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(drawCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      
      return tCanvas.toDataURL('image/png');
    };

    gifshot.createGIF({
      images: [captureFrame(false), captureFrame(true)],
      gifWidth: exportWidth,
      gifHeight: exportHeight,
      interval: 1 
    }, function(obj: any) {
      if(!obj.error) {
        const a = document.createElement('a');
        a.href = obj.image;
        a.download = 'ratio_plane.gif';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert("GIFの生成に失敗しました。");
      }
      if (r.answerGroup) r.answerGroup.visible = sr.current.isAnswerVisible;
      if (r.userGroup) r.userGroup.visible = sr.current.isAnswerVisible;
      r.mainRenderer!.render(r.scene!, r.camera!);
      setIsExporting(false);
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        performUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {isAnswerVisible && modeType === 'rectangle' && (
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
            正解: {answerRatio.x} : {answerRatio.y}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #ccc', paddingTop: '12px', width: '100%', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#388e3c' }}>予想(緑):</span>
            <input 
              type="number" step="0.1" min="0.1" value={userRatio.x} 
              onChange={e => setUserRatio(p => ({...p, x: Number(e.target.value)}))} 
              style={{ width: '60px', padding: '4px', fontSize: '16px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
            <span style={{ fontWeight: 'bold' }}>:</span>
            <input 
              type="number" step="0.1" min="0.1" value={userRatio.y} 
              onChange={e => setUserRatio(p => ({...p, y: Number(e.target.value)}))} 
              style={{ width: '60px', padding: '4px', fontSize: '16px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
          </div>
        </div>
      )}
      
      {isAnswerVisible && modeType === 'triangle' && (
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
            正解角度: {sr.current.currentAngle}° / {90 - sr.current.currentAngle}° / 90°
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ position: 'absolute', top: 20, left: 20, padding: 16, zIndex: 20, width: 220 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block', marginBottom: 4 }}>問題タイプ</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button 
              className={`glass-button ${modeType === 'rectangle' ? 'btn-primary' : 'btn-light'}`}
              style={{ flex: 1, padding: '4px 0', fontSize: 12 }}
              onClick={() => setModeType('rectangle')}
            >
              長方形
            </button>
            <button 
              className={`glass-button ${modeType === 'triangle' ? 'btn-primary' : 'btn-light'}`}
              style={{ flex: 1, padding: '4px 0', fontSize: 12 }}
              onClick={() => setModeType('triangle')}
            >
              直角三角形
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ position: 'absolute', bottom: 30, right: 30, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 30 }}>
        <div style={{ display: 'flex', gap: 6, marginRight: 10, paddingRight: 10, borderRight: '1px solid rgba(0,0,0,0.1)' }}>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setCurrentTool('pen'); setCurrentColor(c); }}
              style={{
                width: 24, height: 24, borderRadius: '50%', backgroundColor: c, border: 'none', cursor: 'pointer',
                boxShadow: currentColor === c && currentTool === 'pen' ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none',
                transition: '0.2s'
              }}
            />
          ))}
        </div>
        <button className={`btn-tool ${currentTool === 'eraser' ? 'active' : ''}`} onClick={() => setCurrentTool('eraser')}>消しゴム</button>
        <button className="btn-tool" onClick={performUndo}>↶ Undo</button>
      </div>

      <div style={{ position: 'absolute', bottom: 30, left: 30, zIndex: 20 }}>
        <button className="glass-button btn-warning" onClick={handleExportGif} disabled={isExporting}>
          {isExporting ? '生成中...' : 'GIF保存'}
        </button>
      </div>

      <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 12 }}>
        <button className="glass-button btn-light" onClick={() => { refs.current.ctxDraw?.clearRect(0, 0, drawCanvasRef.current!.width, drawCanvasRef.current!.height); refs.current.undoStack.push(refs.current.ctxDraw!.getImageData(0, 0, drawCanvasRef.current!.width, drawCanvasRef.current!.height)); }}>全消去</button>
        <button className="glass-button btn-success" onClick={generateRandomBlock}>次のお題</button>
        <button className={`glass-button btn-primary outline ${isGridVisible ? 'active' : ''}`} onClick={() => setGridSync(!isGridVisible)}>補助線</button>
        <button className={`glass-button ${isAnswerVisible ? 'btn-danger' : 'btn-primary'}`} style={{ width: 140 }} onClick={() => setAnswerSync(!isAnswerVisible)}>
          {isAnswerVisible ? '答えを隠す' : '答え合わせ'}
        </button>
      </div>
    </>
  );
}
