import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gifshot from 'gifshot';

const COLORS = ['#607d8b', '#ab47bc', '#81c784', '#64b5f6', '#111111'];

export default function RatioCuboidMode() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);

  const [fov, setFov] = useState(50);
  const [rx, setRx] = useState(25);
  const [ry, setRy] = useState(45);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0]);
  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [modeType, setModeType] = useState<'random' | 'two_same'>('random');
  
  const [answerRatio, setAnswerRatio] = useState({ x: 1, y: 1, z: 1 });
  const [userRatio, setUserRatio] = useState({ x: 1, y: 1, z: 1 });

  const sr = useRef({ 
    fov: 50, rx: 25, ry: 45, zoom: 1.0, 
    isGridVisible: false, isAnswerVisible: false, modeType: 'random',
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
    const baseZ = 35;
    const zPos = (baseZ / Math.tan((state.fov * Math.PI / 180) / 2)) / state.zoom;
    r.camera.position.z = zPos;
    r.thumbnailCamera.position.z = zPos;
    r.camera.updateProjectionMatrix();
    r.thumbnailCamera.updateProjectionMatrix();

    r.targetGroup.rotation.set(state.rx * Math.PI / 180, state.ry * Math.PI / 180, 0);
    r.targetGroup.updateMatrixWorld(true);

    if (r.gridGroup) r.gridGroup.visible = state.isGridVisible;

    r.scene.updateMatrixWorld(true);

    if (r.answerGroup) r.answerGroup.visible = state.isAnswerVisible;
    if (r.userGroup) r.userGroup.visible = state.isAnswerVisible;

    r.mainRenderer.render(r.scene, r.camera);

    if (r.answerGroup) r.answerGroup.visible = true;
    if (r.userGroup) r.userGroup.visible = true; // Show overlay in thumbnail too
    r.thumbnailRenderer.render(r.scene, r.thumbnailCamera);

    if (r.answerGroup) r.answerGroup.visible = state.isAnswerVisible;
    if (r.userGroup) r.userGroup.visible = state.isAnswerVisible;
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
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.lookAt(0, 0, 0);
    
    const thumbnailCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
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
    
    // Anchor to the -X, -Y, -Z corner instead of center
    mesh.position.set((ux - origW) / 2, (uy - origH) / 2, (uz - origD) / 2);
    r.userGroup.add(mesh);

    const edges = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x388e3c });
    const pos = edges.attributes.position.array;
    for (let i = 0; i < pos.length; i += 6) {
      const p1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]);
      const p2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]);
      // Apply the same corner offset to the lines
      p1.add(mesh.position);
      p2.add(mesh.position);
      addThickLine(r.userGroup, p1, p2, edgeMat, 0.06);
    }

    r.userGroup.visible = sr.current.isAnswerVisible;
    r.targetGroup.add(r.userGroup);

    renderScene();
  };

  // Called when userRatio state changes
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

    const blackMat = new THREE.MeshBasicMaterial({ color: 0x333333 }); // Frame normal
    const frameOneMat = new THREE.MeshBasicMaterial({ color: 0xab47bc }); // Purple
    const edges = new THREE.EdgesGeometry(geo);
    
    const pos = edges.attributes.position.array;
    for (let i = 0; i < pos.length; i += 6) {
      const p1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]);
      const p2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]);
      
      const dist = p1.distanceTo(p2);
      if (Math.abs(dist - unitSize) < 0.1) {
        addThickLine(r.targetGroup, p1, p2, frameOneMat, 0.08); // thicker red line for 1 unit
      } else {
        addThickLine(r.targetGroup, p1, p2, blackMat, 0.04);
      }
    }

    // --- Answer Group ---
    r.answerGroup = new THREE.Group();
    const answerSolidMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const aCube = new THREE.Mesh(geo, answerSolidMat);
    r.answerGroup.add(aCube);
    
    const gridInnerMat = new THREE.MeshBasicMaterial({ color: 0x64b5f6 }); // Soft blue for inner grid
    
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

    r.answerGroup.visible = sr.current.isAnswerVisible;
    r.targetGroup.add(r.answerGroup);

    // Initial User Group update
    sr.current.userX = x;
    sr.current.userY = y;
    sr.current.userZ = z;
    updateUserGroup();

    // Grid (XZ, XY, YZ)
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
        a.download = 'ratio_cuboid.gif';
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

      <div className="glass-panel" style={{ position: 'absolute', top: 20, left: 20, padding: 16, zIndex: 20, width: 220 }}>
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
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label>パースの強さ: <span>{fov}</span></label>
          <input type="range" min="30" max="120" value={fov} onChange={e => setFovSync(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
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
