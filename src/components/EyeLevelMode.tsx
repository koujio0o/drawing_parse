import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gifshot from 'gifshot';
import useUndoStack from '../hooks/useUndoStack';
import useDrawingCanvas from '../hooks/useDrawingCanvas';
import useZoomControls from '../hooks/useZoomControls';
import DrawingToolbar from './DrawingToolbar';

const COLORS = ['#607d8b', '#ab47bc', '#81c784', '#64b5f6', '#111111'];

export default function EyeLevelMode() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const undoStack = useUndoStack({ canvasRef: drawCanvasRef });
  const drawing = useDrawingCanvas({ undoStack, palette: COLORS as any });
  const doRedraw = () => {
    const ctx = undoStack.ctxRef.current;
    if (ctx) drawing.redrawAll(ctx, undoStack.getCurrentStrokes());
  };
  
  const setZoomSync = (v: number | ((z: number) => number)) => {
    const newZ = typeof v === 'function' ? v(sr.current.zoom) : v;
    sr.current.zoom = newZ; renderScene();
  };

  useZoomControls({
    canvasRef: drawCanvasRef,
    onZoomChange: setZoomSync,
    getZoom: () => sr.current.zoom,
  });
  const [isExporting, setIsExporting] = useState(false);

  const [fov, setFov] = useState(() => {
    const saved = localStorage.getItem('globalFov');
    return saved ? parseInt(saved, 10) : 50;
  });
  const [hintLengthUI, setHintLengthUI] = useState(() => {
    const saved = localStorage.getItem('eyeLevelHintLengthUI');
    return saved ? parseInt(saved, 10) : 30;
  });
  const [eyeLineRange, setEyeLineRange] = useState(() => {
    const saved = localStorage.getItem('eyeLevelEyeLineRange');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showFullBottomEdge, setShowFullBottomEdge] = useState(() => {
    const saved = localStorage.getItem('eyeLevelShowFullBottomEdge');
    return saved ? saved === 'true' : false;
  });
  const [eyeLineLengthUI, setEyeLineLengthUI] = useState(() => {
    const saved = localStorage.getItem('eyeLevelEyeLineLengthUI');
    return saved ? parseInt(saved, 10) : 30;
  });

  const [isSymmetrical, setIsSymmetrical] = useState(() => {
    const saved = localStorage.getItem('eyeLevelIsSymmetrical');
    return saved ? saved === 'true' : true;
  });

  const sr = useRef({ 
    zoom: 1.0, isAnswerVisible: false, 
    cubeYOffset: 0, fov, hintLengthUI, eyeLineRange,
    showFullBottomEdge, eyeLineLengthUI, isSymmetrical,
    S: 6, baseZ: 12
  });

  const refs = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    mainRenderer: null as THREE.WebGLRenderer | null,
    targetGroup: null as THREE.Group | null,
    answerGroup: null as THREE.Group | null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    initialPinchDist: null as number | null,
    initialZoom: 1.0,
  });

  const renderScene = () => {
    const r = refs.current;
    if (!r.scene || !r.camera || !r.mainRenderer || !r.targetGroup) return;
    
    const state = sr.current;
    
    // Position camera dynamically to ensure both eye line and object fit on screen
    r.camera.fov = state.fov;
    r.camera.position.set(0, 0, (state.baseZ / Math.tan(((state.fov * Math.PI) / 180) / 2)) / state.zoom);
    r.camera.lookAt(0, 0, 0);
    r.camera.updateProjectionMatrix();

    r.scene.updateMatrixWorld(true);

    if (r.answerGroup) r.answerGroup.visible = state.isAnswerVisible;
    r.mainRenderer.render(r.scene, r.camera);
  };

  const setFovSync = (v: number) => {
    sr.current.fov = v;
    setFov(v);
    localStorage.setItem('globalFov', v.toString());
    renderScene();
  };

  const setHintLengthUISync = (v: number) => {
    sr.current.hintLengthUI = v;
    setHintLengthUI(v);
    localStorage.setItem('eyeLevelHintLengthUI', v.toString());
    generateRandomScene(true);
  };

  const setEyeLineRangeSync = (v: number) => {
    sr.current.eyeLineRange = v;
    setEyeLineRange(v);
    localStorage.setItem('eyeLevelEyeLineRange', v.toString());
    generateRandomScene(true);
  };

  const setShowFullBottomEdgeSync = (v: boolean) => {
    sr.current.showFullBottomEdge = v;
    setShowFullBottomEdge(v);
    localStorage.setItem('eyeLevelShowFullBottomEdge', v.toString());
    generateRandomScene(true);
  };

  const setEyeLineLengthUISync = (v: number) => {
    sr.current.eyeLineLengthUI = v;
    setEyeLineLengthUI(v);
    localStorage.setItem('eyeLevelEyeLineLengthUI', v.toString());
    generateRandomScene(true);
  };

  const setIsSymmetricalSync = (v: boolean) => {
    sr.current.isSymmetrical = v;
    setIsSymmetrical(v);
    localStorage.setItem('eyeLevelIsSymmetrical', v.toString());
    generateRandomScene(true);
  };


  const setAnswerSync = (v: boolean) => { sr.current.isAnswerVisible = v; setIsAnswerVisible(v); renderScene(); };

  useEffect(() => {
    const onContextMenu = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu, { passive: false });


    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f7);
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.z = 20;
    camera.lookAt(0, 0, 0);

    const mainRenderer = new THREE.WebGLRenderer({ canvas: mainCanvasRef.current!, antialias: true, preserveDrawingBuffer: true });
    mainRenderer.setPixelRatio(window.devicePixelRatio);
    
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    refs.current.scene = scene;
    refs.current.camera = camera;
    refs.current.mainRenderer = mainRenderer;

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const r = refs.current;
      
      if(drawCanvasRef.current) { drawCanvasRef.current.width = w; drawCanvasRef.current.height = h; }
      mainRenderer.setSize(w, h);
      
      doRedraw();
      
      if (r.camera) {
        r.camera.aspect = w / h;
        r.camera.updateProjectionMatrix();
        renderScene();
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    generateRandomScene();

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
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

  const generateRandomScene = (keepOffset: boolean = false) => {
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

    if (!keepOffset) {
      const newS = 4 + Math.random() * 5; // Base size varies from 4 to 9
      sr.current.S = newS;
      const rangeRatio = sr.current.eyeLineRange / 100;
      const maxDistance = (newS / 2) + (newS * rangeRatio);
      sr.current.cubeYOffset = (Math.random() * 2 - 1) * maxDistance;
      // Ensure both the eye level mark (at y=0) and the cube fit on screen
      sr.current.baseZ = Math.max(12, Math.abs(sr.current.cubeYOffset) + newS / 2 + 2);
    }
    const S = sr.current.S;
    const yOffset = sr.current.cubeYOffset;

    let rotY = -Math.PI / 4;
    if (!sr.current.isSymmetrical) {
      const isSteep = Math.random() > 0.5;
      const angleDeg = isSteep ? (Math.random() * 20 + 60) : (Math.random() * 20 + 10);
      rotY = -angleDeg * Math.PI / 180;
    }

    const allCubesGroup = new THREE.Group();
    allCubesGroup.position.y = yOffset;
    
    allCubesGroup.rotation.y = rotY;

    const cubeGeo = new THREE.BoxGeometry(S, S, S);
    
    const faceMat = new THREE.MeshBasicMaterial({ color: 0x64b5f6, transparent: true, opacity: 0.15, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x333333 }); 
    const refEdgeMat = new THREE.MeshBasicMaterial({ color: 0xab47bc }); 

    const addCube = (ix: number, iz: number, isAnswer: boolean) => {
      const mesh = new THREE.Mesh(cubeGeo, faceMat);
      mesh.position.set(-S/2 - ix*S, 0, -S/2 - iz*S);
      
      const groupToAddTo = isAnswer ? r.answerGroup : r.targetGroup;
      
      const wrapper = new THREE.Group();
      wrapper.add(mesh);
      
      const edges = new THREE.EdgesGeometry(cubeGeo);
      const pos = edges.attributes.position.array;
      for (let i = 0; i < pos.length; i += 6) {
        const p1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2]).add(mesh.position);
        const p2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]).add(mesh.position);
        
        if (!isAnswer) continue; 
        
        addThickLine(wrapper, p1, p2, edgeMat, 0.04);
      }
      groupToAddTo!.add(wrapper);
    };

    const pTop = new THREE.Vector3(0, S/2, 0);
    const pBot = new THREE.Vector3(0, -S/2, 0);
    addThickLine(r.targetGroup, pTop.clone().add(allCubesGroup.position), pBot.clone().add(allCubesGroup.position), refEdgeMat, 0.08);

    for (let ix = 0; ix < 3; ix++) {
      addCube(ix, 0, true);
    }
    
    // Hint: Short line for the bottom-left edge (チラ見せ) or full edge
    const hintLength = sr.current.showFullBottomEdge ? S : (sr.current.hintLengthUI * 0.05); // decoupled absolute length, or full edge S
    if (hintLength > 0.01) {
      const pHintLocal = new THREE.Vector3(-hintLength, -S/2, 0);
      pHintLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      pHintLocal.add(allCubesGroup.position);
      addThickLine(r.targetGroup, pBot.clone().add(allCubesGroup.position), pHintLocal, refEdgeMat, 0.08);
    }

    // The eye level mark (a short horizontal line at y=0, since camera is at y=0)
    const markLength = sr.current.eyeLineLengthUI * 0.05;
    if (markLength > 0.01) {
      const pLeft = new THREE.Vector3(-markLength/2, 0, 0);
      const pRight = new THREE.Vector3(markLength/2, 0, 0);
      addThickLine(r.targetGroup, pLeft, pRight, refEdgeMat, 0.05);
    }

    // Apply the 45 deg rotation to the answer group (and we've already manually applied it to the single edge by adding allCubesGroup.position, wait!
    // For the front edge: its local X, Z is 0. So rotating it on Y doesn't change its world position! It's perfectly safe to just apply y offset.
    // But for the answerGroup, we must rotate it.
    r.answerGroup!.position.y = yOffset;
    r.answerGroup!.rotation.y = rotY;

    r.answerGroup!.visible = sr.current.isAnswerVisible;
    r.targetGroup.add(r.answerGroup!);
    r.scene.add(r.targetGroup);

    sr.current.zoom = 1.0;
    if (sr.current.isAnswerVisible) {
      sr.current.isAnswerVisible = false;
      setIsAnswerVisible(false);
    }

    undoStack.reset();
    doRedraw(); 

    renderScene();
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
        a.download = 'eye_level.gif';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert("GIFの生成に失敗しました。");
      }
      if (r.answerGroup) r.answerGroup.visible = sr.current.isAnswerVisible;
      r.mainRenderer!.render(r.scene!, r.camera!);
      setIsExporting(false);
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoStack.performUndo(doRedraw);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* Top-left: perspective sliders */}
      <div className="glass-panel" style={{ position: 'absolute', top: 20, left: 20, padding: 16, zIndex: 20, width: 220 }}>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isSymmetrical} onChange={e => setIsSymmetricalSync(e.target.checked)} />
            左右対称
          </label>
        </div>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label>パースの強さ: <span>{fov}</span></label>
          <input type="range" min={30} max={150} value={fov} onChange={e => setFovSync(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>チラ見せ線の長さ</span>
            <label style={{ fontSize: 12, fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={showFullBottomEdge} onChange={e => setShowFullBottomEdgeSync(e.target.checked)} />
              100%
            </label>
          </label>
          <input type="range" min={0} max={400} value={hintLengthUI} disabled={showFullBottomEdge} onChange={e => setHintLengthUISync(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label>アイラインの長さ</label>
          <input type="range" min={0} max={400} value={eyeLineLengthUI} onChange={e => setEyeLineLengthUISync(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 'bold' }}>
          <label>アイラインの範囲拡張: <span>+{eyeLineRange}%</span></label>
          <input type="range" min={0} max={300} step={10} value={eyeLineRange} onChange={e => setEyeLineRangeSync(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
      </div>

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
        onTouchStart={drawing.handlers.onTouchStart}
        onTouchEnd={drawing.handlers.onTouchEnd}
        onTouchCancel={drawing.handlers.onTouchCancel}
      />

      <DrawingToolbar
        drawing={drawing}
        onUndo={() => undoStack.performUndo(doRedraw)}
        onExportGif={handleExportGif}
        isExporting={isExporting}
      />

      <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 12 }}>
        <button className="glass-button btn-light" onClick={() => undoStack.clearAll(doRedraw)}>全消去</button>
        <button className="glass-button btn-success" onClick={() => generateRandomScene()}>次のお題</button>
        <button className={`glass-button ${isAnswerVisible ? 'btn-danger' : 'btn-primary'}`} style={{ width: 140 }} onClick={() => setAnswerSync(!isAnswerVisible)}>
          {isAnswerVisible ? '答えを隠す' : '答え合わせ'}
        </button>
      </div>
    </>
  );
}
