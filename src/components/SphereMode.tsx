import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gifshot from 'gifshot';

const COLORS = ['#607d8b', '#ff3b30', '#34c759', '#007aff', '#111111'];

export default function SphereMode() {
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const answerCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const [fov, setFov] = useState(80);
  const [rx, setRx] = useState(25);
  const [ry, setRy] = useState(45);
  const [zoom, setZoom] = useState(1.0);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0]);
  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const refs = useRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    targetGroup: null as THREE.Group | null,
    gridGroup: null as THREE.Group | null,
    boundingBoxMesh: null as THREE.Mesh | null,
    answerMesh: null as THREE.Group | null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    initialPinchDist: null as number | null,
    initialZoom: 1.0,
    undoStack: [] as ImageData[],
    ctxDraw: null as CanvasRenderingContext2D | null,
    ctxGuide: null as CanvasRenderingContext2D | null,
    ctxAnswer: null as CanvasRenderingContext2D | null,
  });

  useEffect(() => {
    const onContextMenu = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu, { passive: false });

    const cGuide = guideCanvasRef.current!;
    const cDraw = drawCanvasRef.current!;
    const cAnswer = answerCanvasRef.current!;
    refs.current.ctxGuide = cGuide.getContext('2d');
    refs.current.ctxDraw = cDraw.getContext('2d');
    refs.current.ctxAnswer = cAnswer.getContext('2d');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f7);
    const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.lookAt(0, 0, 0);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(200, 200);
    if (thumbnailRef.current) thumbnailRef.current.appendChild(renderer.domElement);
    
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    refs.current.scene = scene;
    refs.current.camera = camera;
    refs.current.renderer = renderer;

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const r = refs.current;
      const tempImageData = r.undoStack.length > 0 && r.ctxDraw ? r.ctxDraw.getImageData(0, 0, cDraw.width, cDraw.height) : null;
      
      [cGuide, cDraw, cAnswer].forEach(c => { c.width = w; c.height = h; });
      
      if (r.ctxDraw) {
        r.ctxDraw.lineCap = 'round';
        r.ctxDraw.lineJoin = 'round';
        if (tempImageData) r.ctxDraw.putImageData(tempImageData, 0, 0);
      }
      
      if (r.camera) {
        r.camera.aspect = w / h;
        r.camera.updateProjectionMatrix();
        drawGuide();
        if (isAnswerVisible) drawAnswer();
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    generateRandomBlock();

    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
      if (renderer.domElement && thumbnailRef.current) thumbnailRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const r = refs.current;
    if (!r.camera || !r.scene || !r.renderer) return;

    r.camera.fov = fov;
    const baseZ = 20; 
    r.camera.position.z = (baseZ / Math.tan((fov * Math.PI / 180) / 2)) / zoom;
    r.camera.updateProjectionMatrix();

    if (r.targetGroup) {
      r.targetGroup.rotation.set(rx * Math.PI / 180, ry * Math.PI / 180, 0);
    }

    r.scene.updateMatrixWorld(true);
    r.renderer.render(r.scene, r.camera);
    drawGuide();
    if (isAnswerVisible) {
      drawAnswer();
    } else if (r.ctxAnswer && answerCanvasRef.current) {
      r.ctxAnswer.clearRect(0, 0, answerCanvasRef.current.width, answerCanvasRef.current.height);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fov, rx, ry, zoom, isGridVisible, isAnswerVisible]);

  const generateRandomBlock = () => {
    const r = refs.current;
    if (!r.scene || !r.camera || !r.ctxDraw) return;

    if (r.targetGroup) r.scene.remove(r.targetGroup);
    r.targetGroup = new THREE.Group();
    
    const size = 6;
    const sx = size;
    const sy = size;
    const sz = size * 2;
    (r as any).boxSizes = { sx, sy, sz };

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
    r.gridGroup.visible = isGridVisible;
    r.targetGroup.add(r.gridGroup);

    setRx(randRx);
    setRy(randRy);
    setZoom(1.0);
    
    r.ctxDraw.clearRect(0, 0, drawCanvasRef.current!.width, drawCanvasRef.current!.height);
    r.undoStack = []; 
    if (isAnswerVisible) setIsAnswerVisible(false); 
  };

  const drawGuide = () => {
    const r = refs.current;
    if (!r.ctxGuide || !r.boundingBoxMesh || !r.camera || !r.targetGroup) return;
    const canvas = guideCanvasRef.current!;

    r.ctxGuide.clearRect(0, 0, canvas.width, canvas.height);

    if (isGridVisible && r.gridGroup) {
      r.ctxGuide.strokeStyle = 'rgba(0, 122, 255, 0.15)';
      r.ctxGuide.lineWidth = 1;
      r.gridGroup.children.forEach(grid => {
        const positions = (grid as THREE.LineSegments).geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 6) {
          const v1 = new THREE.Vector3(positions[i], positions[i+1], positions[i+2]).applyMatrix4(grid.matrixWorld).project(r.camera!);
          const v2 = new THREE.Vector3(positions[i+3], positions[i+4], positions[i+5]).applyMatrix4(grid.matrixWorld).project(r.camera!);
          if(v1.z > 1 || v2.z > 1) continue;
          r.ctxGuide!.beginPath();
          r.ctxGuide!.moveTo((v1.x * 0.5 + 0.5) * canvas.width, (-(v1.y) * 0.5 + 0.5) * canvas.height);
          r.ctxGuide!.lineTo((v2.x * 0.5 + 0.5) * canvas.width, (-(v2.y) * 0.5 + 0.5) * canvas.height);
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
      r.ctxGuide.moveTo((v1.x * 0.5 + 0.5) * canvas.width, (-(v1.y) * 0.5 + 0.5) * canvas.height);
      r.ctxGuide.lineTo((v2.x * 0.5 + 0.5) * canvas.width, (-(v2.y) * 0.5 + 0.5) * canvas.height);
      r.ctxGuide.stroke();
    }

    const sizes = (r as any).boxSizes;
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
        r.ctxGuide!.moveTo((v1.x * 0.5 + 0.5) * canvas.width, (-(v1.y) * 0.5 + 0.5) * canvas.height);
        r.ctxGuide!.lineTo((v2.x * 0.5 + 0.5) * canvas.width, (-(v2.y) * 0.5 + 0.5) * canvas.height);
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
        const x = (v.x * 0.5 + 0.5) * canvas.width;
        const y = (-(v.y) * 0.5 + 0.5) * canvas.height;
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
    if (!r.ctxAnswer || !r.answerMesh || !r.camera || !r.targetGroup) return;
    const canvas = answerCanvasRef.current!;

    r.ctxAnswer.clearRect(0, 0, canvas.width, canvas.height);
    
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
            const x = (v.x * 0.5 + 0.5) * canvas.width;
            const y = (-(v.y) * 0.5 + 0.5) * canvas.height;
            if (i === 0) r.ctxAnswer!.moveTo(x, y);
            else r.ctxAnswer!.lineTo(x, y);
          }
          r.ctxAnswer!.stroke();
        }
      });
      r.ctxAnswer!.setLineDash([]);
    }
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

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      refs.current.initialPinchDist = Math.sqrt(dx * dx + dy * dy);
      refs.current.initialZoom = zoom;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && refs.current.initialPinchDist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / refs.current.initialPinchDist;
      setZoom(Math.max(0.1, Math.min(5.0, refs.current.initialZoom * scale)));
    }
  };

  const handleTouchEnd = () => {
    refs.current.initialPinchDist = null;
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.1, Math.min(5.0, z - e.deltaY * 0.005)));
  };

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd);
      canvas.addEventListener('touchcancel', handleTouchEnd);
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (canvas) {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('touchcancel', handleTouchEnd);
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, [zoom]);

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
    if (!r.scene || !r.camera || !r.renderer || isExporting) return;
    
    setIsExporting(true);
    const scale = Math.min(1, 800 / window.innerWidth);
    const exportWidth = window.innerWidth * scale;
    const exportHeight = window.innerHeight * scale;

    const captureFrame = (withAnswer: boolean) => {
      const tCanvas = document.createElement('canvas');
      tCanvas.width = exportWidth; tCanvas.height = exportHeight;
      const tCtx = tCanvas.getContext('2d')!;

      tCtx.fillStyle = '#f5f5f7';
      tCtx.fillRect(0, 0, exportWidth, exportHeight);

      tCtx.drawImage(guideCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      tCtx.drawImage(drawCanvasRef.current!, 0, 0, exportWidth, exportHeight);
      
      if (withAnswer) {
        if (!isAnswerVisible) drawAnswer(); 
        tCtx.drawImage(answerCanvasRef.current!, 0, 0, exportWidth, exportHeight);
        if (!isAnswerVisible && r.ctxAnswer) r.ctxAnswer.clearRect(0, 0, answerCanvasRef.current!.width, answerCanvasRef.current!.height); 
      }
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
        a.download = 'perspective_sphere.gif';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert("GIF生成失敗");
      }
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <canvas ref={answerCanvasRef} className="layer-canvas" style={{ zIndex: 15 }} />

      <div className="glass-panel" style={{ position: 'absolute', top: 20, left: 20, padding: 16, zIndex: 20, width: 220 }}>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label>パースの強さ: <span>{fov}</span></label>
          <input type="range" min="50" max="150" value={fov} onChange={e => setFov(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label>縦アングル: <span>{rx}</span>°</label>
          <input type="range" min="-80" max="80" value={rx} onChange={e => setRx(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 'bold' }}>
          <label>横アングル: <span>{ry}</span>°</label>
          <input type="range" min="-180" max="180" value={ry} onChange={e => setRy(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
        </div>
      </div>

      <div className="glass-panel" style={{ position: 'absolute', top: 20, right: 20, width: 200, height: 200, overflow: 'hidden', zIndex: 20, padding: 0 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: 12, textAlign: 'center', padding: '4px 0', zIndex: 21 }}>
          お題（1:1:2の楕円体）
        </div>
        <div ref={thumbnailRef} style={{ width: '100%', height: '100%' }}></div>
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
        <button className={`glass-button btn-primary outline ${isGridVisible ? 'active' : ''}`} onClick={() => setIsGridVisible(!isGridVisible)}>補助線</button>
        <button className={`glass-button ${isAnswerVisible ? 'btn-danger' : 'btn-primary'}`} style={{ width: 140 }} onClick={() => { setIsAnswerVisible(!isAnswerVisible); if(isAnswerVisible && refs.current.ctxAnswer) refs.current.ctxAnswer.clearRect(0,0,answerCanvasRef.current!.width, answerCanvasRef.current!.height); }}>
          {isAnswerVisible ? '答えを隠す' : '答え合わせ'}
        </button>
      </div>
    </>
  );
}
