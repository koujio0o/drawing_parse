import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gifshot from 'gifshot';

const COLORS = ['#607d8b', '#ff3b30', '#34c759', '#007aff', '#111111'];

export default function ProliferationMode() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);

  // React state only for UI rendering
  const [fov, setFov] = useState(80);
  const [rx, setRx] = useState(25);
  const [ry, setRy] = useState(45);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0]);
  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Synchronous state for WebGL rendering to avoid React batching/closure issues
  const sr = useRef({ fov: 80, rx: 25, ry: 45, zoom: 1.0, isGridVisible: false, isAnswerVisible: false });

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
    if (!r.scene || !r.camera || !r.mainRenderer || !r.thumbnailRenderer || !r.thumbnailCamera || !r.targetGroup) return;
    
    const state = sr.current;

    r.camera.fov = state.fov;
    r.thumbnailCamera.fov = state.fov;
    const baseZ = 20;
    const zPos = (baseZ / Math.tan((state.fov * Math.PI / 180) / 2)) / state.zoom;
    r.camera.position.z = zPos;
    r.thumbnailCamera.position.z = zPos;
    r.camera.updateProjectionMatrix();
    r.thumbnailCamera.updateProjectionMatrix();

    r.targetGroup.rotation.set(state.rx * Math.PI / 180, state.ry * Math.PI / 180, 0);
    r.targetGroup.updateMatrixWorld(true);

    if (r.gridGroup) r.gridGroup.visible = state.isGridVisible;

    r.scene.updateMatrixWorld(true);

    // Draw Main
    if (r.trackGroup) r.trackGroup.visible = state.isAnswerVisible;
    if (r.answerGroup) r.answerGroup.visible = state.isAnswerVisible;
    r.mainRenderer.render(r.scene, r.camera);

    // Draw Thumbnail
    if (r.trackGroup) r.trackGroup.visible = false;
    if (r.answerGroup) r.answerGroup.visible = true;
    r.thumbnailRenderer.render(r.scene, r.thumbnailCamera);

    // Restore visibility
    if (r.trackGroup) r.trackGroup.visible = state.isAnswerVisible;
    if (r.answerGroup) r.answerGroup.visible = state.isAnswerVisible;
  };

  const setRxSync = (v: number) => { sr.current.rx = v; setRx(v); renderScene(); };
  const setRySync = (v: number) => { sr.current.ry = v; setRy(v); renderScene(); };
  const setZoomSync = (v: number | ((z: number) => number)) => {
    const newZ = typeof v === 'function' ? v(sr.current.zoom) : v;
    sr.current.zoom = newZ; renderScene();
  };
  const setFovSync = (v: number) => { sr.current.fov = v; setFov(v); renderScene(); };
  const setGridSync = (v: boolean) => { sr.current.isGridVisible = v; setIsGridVisible(v); renderScene(); };
  const setAnswerSync = (v: boolean) => { sr.current.isAnswerVisible = v; setIsAnswerVisible(v); renderScene(); };

  useEffect(() => {
    const onContextMenu = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu, { passive: false });

    const cDraw = drawCanvasRef.current!;
    refs.current.ctxDraw = cDraw.getContext('2d');

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

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const r = refs.current;
      const tempImageData = r.undoStack.length > 0 && r.ctxDraw ? r.ctxDraw.getImageData(0, 0, cDraw.width, cDraw.height) : null;
      
      cDraw.width = w; cDraw.height = h;
      mainRenderer.setSize(w, h);
      
      if (thumbnailCanvasRef.current) {
        thumbnailRenderer.setSize(thumbnailCanvasRef.current.clientWidth, thumbnailCanvasRef.current.clientHeight, false);
      }
      
      if (r.ctxDraw) {
        r.ctxDraw.lineCap = 'round';
        r.ctxDraw.lineJoin = 'round';
        if (tempImageData) r.ctxDraw.putImageData(tempImageData, 0, 0);
      }
      
      if (r.camera) {
        r.camera.aspect = w / h;
        r.camera.updateProjectionMatrix();
        renderScene();
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    generateRandomBlock();

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
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
    // Center box: Blue and slightly more opaque
    const matA = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.15 });
    cubeA.add(new THREE.Mesh(geoA, matA));
    
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    addEdgesToGroup(cubeA, new THREE.EdgesGeometry(geoA), blackMat);
    r.targetGroup.add(cubeA);

    const themeDirs = [ [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1] ];
    const randomDir = themeDirs[Math.floor(Math.random() * themeDirs.length)];
    
    const cubeB = new THREE.Group();
    // Adjacent box: Gray and slightly more transparent to indicate it's a secondary hint
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

    for (let y of [-s, s]) {
      for (let z of [-s, s]) {
        addThickLine(r.trackGroup, new THREE.Vector3(-L, y, z), new THREE.Vector3(L, y, z), trackMat);
      }
    }
    for (let x of [-s, s]) {
      for (let z of [-s, s]) {
        addThickLine(r.trackGroup, new THREE.Vector3(x, -L, z), new THREE.Vector3(x, L, z), trackMat);
      }
    }
    for (let x of [-s, s]) {
      for (let y of [-s, s]) {
        addThickLine(r.trackGroup, new THREE.Vector3(x, y, -L), new THREE.Vector3(x, y, L), trackMat);
      }
    }
    r.trackGroup.visible = sr.current.isAnswerVisible;
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
    const gridXZ = new THREE.GridHelper(100, 25, gridColor, gridColor); gridXZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gridXY = new THREE.GridHelper(100, 25, gridColor, gridColor); gridXY.rotation.x = Math.PI / 2; gridXY.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gridYZ = new THREE.GridHelper(100, 25, gridColor, gridColor); gridYZ.rotation.z = Math.PI / 2; gridYZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    r.gridGroup.add(gridXZ, gridXY, gridYZ);
    r.gridGroup.visible = sr.current.isGridVisible;
    r.targetGroup.add(r.gridGroup);

    const randRx = Math.floor(Math.random() * 80 - 20);
    const randRy = Math.floor(Math.random() * 180 - 90);
    
    r.scene.add(r.targetGroup);

    // Synchronously update state and force a render
    sr.current.rx = randRx; setRx(randRx);
    sr.current.ry = randRy; setRy(randRy);
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

  // Bind touch events ONCE using refs for stable state reads
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (r.trackGroup) r.trackGroup.visible = withAnswer;
      if (r.answerGroup) r.answerGroup.visible = withAnswer;
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
        a.download = 'perspective_proliferation.gif';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert("GIFの生成に失敗しました。");
      }
      if (r.trackGroup) r.trackGroup.visible = sr.current.isAnswerVisible;
      if (r.answerGroup) r.answerGroup.visible = sr.current.isAnswerVisible;
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

      <div className="glass-panel" style={{ position: 'absolute', top: 20, left: 20, padding: 16, zIndex: 20, width: 220 }}>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label>パースの強さ: <span>{fov}</span></label>
          <input type="range" min="50" max="150" value={fov} onChange={e => setFovSync(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label>縦アングル: <span>{rx}</span>°</label>
          <input type="range" min="-80" max="80" value={rx} onChange={e => setRxSync(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 'bold' }}>
          <label>横アングル: <span>{ry}</span>°</label>
          <input type="range" min="-180" max="180" value={ry} onChange={e => setRySync(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
      </div>

      <div className="glass-panel" style={{ position: 'absolute', top: 20, right: 20, width: 200, height: 200, overflow: 'hidden', zIndex: 20, padding: 0 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: 12, textAlign: 'center', padding: '4px 0', zIndex: 21 }}>
          3Dサムネイル
        </div>
        <canvas ref={thumbnailCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
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
