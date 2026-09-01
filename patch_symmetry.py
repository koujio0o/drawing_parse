import re

with open('src/components/SymmetryMode.tsx', 'r') as f:
    content = f.read()

# Replace generateRandomBlock function
new_generate = """  const generateRandomBlock = () => {
    const r = refs.current;
    if (!r.scene) return;

    if (r.targetGroup) r.scene.remove(r.targetGroup);
    
    r.targetGroup = new THREE.Group();
    r.answerGroup = new THREE.Group();
    
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x333333 });
    const ansFaceMat = new THREE.MeshStandardMaterial({ color: 0xffa726, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const ansEdgeMat = new THREE.LineBasicMaterial({ color: 0x8c3b00 });

    const isExtrude = sr.current.isExtrudeOnly;

    if (isExtrude) {
      // Extrude Alphabet Letters
      const profiles = [
        [ [0, 10], [4, 10], [4, 8], [1, 8], [1, 0], [0, 0] ], // T
        [ [0, 6], [2, 6], [2, 10], [4, 10], [4, 0], [2, 0], [2, 4], [0, 4] ], // H
        [ [0, 0], [1, 0], [4, 10], [2, 10] ], // V
        [ [0, 5], [0, 8], [2, 10], [4, 10], [4, 0], [2, 0], [2, 8] ], // M
        [ [0, 0], [1, 0], [1, 5], [4, 10], [2, 10], [0, 6] ], // Y
        [ [0, 0], [4, 0], [4, 10], [2, 10], [2, 2], [0, 2] ], // U
        [ [0, 4], [2, 0], [4, 0], [1.5, 5], [4, 10], [2, 10], [0, 6] ], // X
        [ [0, 10], [3, 10], [3, 8], [1, 8], [1, 2], [3, 2], [3, 0], [0, 0] ], // I
        [ [0, 10], [2, 10], [4, 0], [2, 0], [1.5, 3], [0, 3], [0, 5], [1.1, 5], [0.5, 8], [0, 8] ] // A
      ];
      const profile = profiles[Math.floor(Math.random() * profiles.length)];

      const rightShape = new THREE.Shape();
      profile.forEach((pt, i) => {
        const px = pt[0] * 1.5;
        const py = (pt[1] - 5) * 1.5;
        if (i === 0) rightShape.moveTo(px, py);
        else rightShape.lineTo(px, py);
      });
      const extrudeRight = new THREE.ExtrudeGeometry(rightShape, { depth: 2, bevelEnabled: false });
      extrudeRight.translate(0, 0, -1);
      const rightMesh = new THREE.Mesh(extrudeRight, faceMat);
      rightMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(extrudeRight), edgeMat));
      r.targetGroup.add(rightMesh);

      const leftShape = new THREE.Shape();
      const leftProfile = [...profile].reverse();
      leftProfile.forEach((pt, i) => {
        const px = -pt[0] * 1.5;
        const py = (pt[1] - 5) * 1.5;
        if (i === 0) leftShape.moveTo(px, py);
        else leftShape.lineTo(px, py);
      });
      const extrudeLeft = new THREE.ExtrudeGeometry(leftShape, { depth: 2, bevelEnabled: false });
      extrudeLeft.translate(0, 0, -1);
      const leftMesh = new THREE.Mesh(extrudeLeft, ansFaceMat);
      leftMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(extrudeLeft), ansEdgeMat));
      r.answerGroup.add(leftMesh);

    } else {
      // Lathe Geometry (Pillars / Bottles)
      const pts = [];
      const numPoints = 5 + Math.floor(Math.random() * 5);
      pts.push(new THREE.Vector2(0, -8)); // close bottom
      let lastX = 2 + Math.random() * 3;
      for (let i = 0; i < numPoints; i++) {
        const y = -8 + (16 / (numPoints - 1)) * i;
        const x = lastX + (Math.random() * 4 - 2);
        lastX = Math.max(1, Math.min(6, x));
        pts.push(new THREE.Vector2(lastX, y));
      }
      pts.push(new THREE.Vector2(0, 8)); // close top

      // Right half (-90 to +90 deg in XZ plane)
      const latheRight = new THREE.LatheGeometry(pts, 16, -Math.PI / 2, Math.PI);
      const rightMesh = new THREE.Mesh(latheRight, faceMat);
      rightMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(latheRight), edgeMat));
      r.targetGroup.add(rightMesh);

      // Left half (90 to 270 deg in XZ plane)
      const latheLeft = new THREE.LatheGeometry(pts, 16, Math.PI / 2, Math.PI);
      const leftMesh = new THREE.Mesh(latheLeft, ansFaceMat);
      leftMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(latheLeft), ansEdgeMat));
      r.answerGroup.add(leftMesh);
    }

    // Mirror Plane Guide (Semi-transparent plane at X=0)
    const planeGeo = new THREE.PlaneGeometry(30, 30);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const mirrorPlane = new THREE.Mesh(planeGeo, planeMat);
    mirrorPlane.rotation.y = Math.PI / 2;
    r.targetGroup.add(mirrorPlane);
    
    // Grid Helper on the mirror plane
    const gridHelper = new THREE.GridHelper(30, 10, 0x007aff, 0x007aff);
    gridHelper.rotation.z = Math.PI / 2;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.2;
    r.targetGroup.add(gridHelper);

    r.targetGroup.add(r.answerGroup);
    
    // Add custom grid group (XY, XZ, YZ)
    if (r.gridGroup) r.scene.remove(r.gridGroup);
    r.gridGroup = new THREE.Group();
    const gridColor = 0x007aff;
    const gSize = 40;
    const gDiv = 20;
    const gXZ = new THREE.GridHelper(gSize, gDiv, gridColor, gridColor); gXZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gXY = new THREE.GridHelper(gSize, gDiv, gridColor, gridColor); gXY.rotation.x = Math.PI / 2; gXY.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    const gYZ = new THREE.GridHelper(gSize, gDiv, gridColor, gridColor); gYZ.rotation.z = Math.PI / 2; gYZ.material = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });
    r.gridGroup.add(gXZ, gXY, gYZ);
    r.gridGroup.visible = visRef.current.isGridVisible;
    r.targetGroup.add(r.gridGroup);

    r.scene.add(r.targetGroup);

    const randRx = Math.floor(Math.random() * 60 - 10);
    const randRy = Math.floor(Math.random() * 120 - 60);
    cam.setRxSync(randRx);
    cam.setRySync(randRy);
    cam.setZoomSync(1.0);

    if (visRef.current.isAnswerVisible) {
      visRef.current.isAnswerVisible = false;
      setIsAnswerVisible(false);
    }
    
    undoStack.reset();
    const ctx = undoStack.ctxRef.current;
    if (ctx && drawCanvasRef.current) {
      ctx.clearRect(0, 0, drawCanvasRef.current.clientWidth, drawCanvasRef.current.clientHeight);
    }

    renderScene();
  };"""

content = re.sub(r'  const generateRandomBlock = \(\) => \{[\s\S]*?    renderScene\(\);\n  \};', new_generate, content)

with open('src/components/SymmetryMode.tsx', 'w') as f:
    f.write(content)

