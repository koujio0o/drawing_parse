import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gifshot from 'gifshot';

const COLORS = ['#607d8b', '#ff3b30', '#34c759', '#007aff', '#111111'];

export default function SphereContourMode() {
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
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
    answerGroupMain: null as THREE.Group | null,
    answerGroupThumb: null as THREE.Group | null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    initialPinchDist: null as number | null,
    initialZoom: 1.0,
    undoStack: [] as ImageData[],
    ctxDraw: null as CanvasRenderingContext2D | null,
    ctxGuide: null as CanvasRenderingContext2D | null,
  });

  const renderScene = () => {
    const r = refs.current;
    if (!r.scene || !r.camera || !r.mainRenderer || !r.thumbnailRenderer || !r.thumbnailCamera || !r.targetGroup) return;
    
    const state = sr.current;

    r.camera.fov = state.fov;
    r.thumbnailCamera.fov = state.fov;
    const baseZ = 12;
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
    if (r.answerGroupMain) r.answerGroupMain.visible = state.isAnswerVisible;
    if (r.answerGroupThumb) r.answerGroupThumb.visible = false;
    r.mainRenderer.render(r.scene, r.camera);
    
    if (r.ctxGuide && guideCanvasRef.current) {
      r.ctxGuide.clearRect(0, 0, guideCanvasRef.current.width, guideCanvasRef.current.height);
    }

    // Draw Thumbnail
    if (r.answerGroupMain) r.answerGroupMain.visible = false;
    if (r.answerGroupThumb) r.answerGroupThumb.visible = true;
    r.thumbnailRenderer.render(r.scene, r.thumbnailCamera);

    // Restore visibility state
    if (r.answerGroupMain) r.answerGroupMain.visible = state.isAnswerVisible;
    if (r.answerGroupThumb) r.answerGroupThumb.visible = false;
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
    const cGuide = guideCanvasRef.current!;
    refs.current.ctxDraw = cDraw.getContext('2d');
    refs.current.ctxGuide = cGuide.getContext('2d');

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
      cGuide.width = w; cGuide.height = h;
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
    // Note: EdgesGeometry on a sphere generates lots of lines. 
    // To just draw the outline, it's better to rely on a custom approach, but a faint mesh works.
    bgSphereMain.add(new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true, transparent: true, opacity: 0.1 })
    ));
    r.targetGroup.add(bgSphereMain);

    // Orientation type (0 = Horizontal XZ, 1 = Vertical XY, 2 = Vertical YZ)
    const orientationType = Math.floor(Math.random() * 3);
    
    let axisA: THREE.Vector3, axisB: THREE.Vector3, axisC: THREE.Vector3;

    if (orientationType === 0) {
      // a is horizontal (XZ plane -> normal Y)
      axisA = new THREE.Vector3(0, 1, 0);
      // b is vertical (XY plane -> normal Z)
      axisB = new THREE.Vector3(0, 0, 1);
      // c is 45 degrees between a and b (rotated around X axis)
      axisC = new THREE.Vector3(0, 1, 1).normalize();
    } else if (orientationType === 1) {
      // a is vertical (XY plane -> normal Z)
      axisA = new THREE.Vector3(0, 0, 1);
      // b is orthogonal vertical (YZ plane -> normal X)
      axisB = new THREE.Vector3(1, 0, 0);
      // c is 45 degrees (rotated around Y axis)
      axisC = new THREE.Vector3(1, 0, 1).normalize();
    } else {
      // a is vertical (YZ plane -> normal X)
      axisA = new THREE.Vector3(1, 0, 0);
      // b is horizontal (XZ plane -> normal Y)
      axisB = new THREE.Vector3(0, 1, 0);
      // c is 45 degrees (rotated around Z axis)
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
    // User wants BOTH horizontal and vertical patterns for perpendicular
    // So if a is axisA, then axisB and axisC_perp are the other two orthogonal axes
    // We already have axisB. Let's define the third orthogonal axis as axisD
    let axisD: THREE.Vector3;
    if (orientationType === 0) axisD = new THREE.Vector3(0, 0, 1);
    else if (orientationType === 1) axisD = new THREE.Vector3(0, 1, 0);
    else axisD = new THREE.Vector3(0, 0, 1); // For YZ, orthogonal are X and Z. We have axisA=X, axisB=Y. Wait, axisB=Y. Z is the third.
    
    const circleB_Main = createGreatCircle(radius + 0.02, axisB, 0xff3b30, 1); // Red
    const circleD_Main = createGreatCircle(radius + 0.03, axisD, 0xff9500, 1); // Orange (the other perpendicular)
    const circleC_Main = createGreatCircle(radius + 0.04, axisC, 0x34c759, 1); // Green (45 deg)
    
    r.answerGroupMain.add(circleB_Main);
    r.answerGroupMain.add(circleD_Main);
    r.answerGroupMain.add(circleC_Main);
    r.answerGroupMain.visible = sr.current.isAnswerVisible;
    r.targetGroup.add(r.answerGroupMain);

    // Answer circles (b and c) for Thumb (no depth issues, just display)
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

    r.isDrawing = true; r.lastX = e.clientX; r.lastY = e.clientY;

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
    r.lastX = e.clientX; r.lastY = e.clientY;
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
      if (r.answerGroupMain) r.answerGroupMain.visible = withAnswer;
      r.mainRenderer!.render(r.scene!, r.camera!);

      const tCanvas = document.createElement('canvas');
      tCanvas.width = exportWidth; tCanvas.height = exportHeight;
      const tCtx = tCanvas.getContext('2d')!;

      tCtx.fillStyle = '#f5f5f7';
      tCtx.fillRect(0, 0, exportWidth, exportHeight);

      tCtx.drawImage(mainCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(guideCanvasRef.current!, 0, 0, exportWidth, exportHeight);
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
        a.download = 'perspective_sphere_contour.gif';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert("GIF生成失敗");
      }
      if (r.answerGroupMain) r.answerGroupMain.visible = sr.current.isAnswerVisible;
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
          お題（直角と45度）
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
