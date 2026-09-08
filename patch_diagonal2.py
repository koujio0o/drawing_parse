import re

with open('src/components/DiagonalCubeMode.tsx', 'r') as f:
    content = f.read()

# Add isHintVisible state and visRef
state_block = """  const [isHintVisible, setIsHintVisible] = useState(() => {
    const saved = localStorage.getItem('diagonalIsHintVisible');
    return saved ? saved === 'true' : true;
  });

  const refs = useRef({"""
content = re.sub(r'  const refs = useRef\(\{', state_block, content)

vis_block = """  // Synchronous visibility state for render loop
  const visRef = useRef({ 
    isGridVisible: false, 
    isAnswerVisible: false, 
    isHintVisible: localStorage.getItem('diagonalIsHintVisible') ? localStorage.getItem('diagonalIsHintVisible') === 'true' : true 
  });"""
content = re.sub(r'  // Synchronous visibility state for render loop\n  const visRef = useRef\(\{ isGridVisible: false, isAnswerVisible: false \}\);', vis_block, content)

ref_block = """    trackGroup: null as THREE.Group | null,
    answerGroup: null as THREE.Group | null,
    hintGroup: null as THREE.Group | null,
  });"""
content = re.sub(r'    trackGroup: null as THREE.Group \| null,\n    answerGroup: null as THREE.Group \| null,\n  \}\);', ref_block, content)


# Update renderScene
render_scene_mod = """    r.scene.updateMatrixWorld(true);

    if (r.hintGroup) r.hintGroup.visible = visRef.current.isHintVisible;

    // Draw Main"""
content = content.replace("    r.scene.updateMatrixWorld(true);\n\n    // Draw Main", render_scene_mod)

sync_mod = """  const setAnswerSync = (v: boolean) => { visRef.current.isAnswerVisible = v; setIsAnswerVisible(v); renderScene(); };
  const setHintSync = (v: boolean) => { visRef.current.isHintVisible = v; setIsHintVisible(v); localStorage.setItem('diagonalIsHintVisible', v.toString()); renderScene(); };"""
content = content.replace("  const setAnswerSync = (v: boolean) => { visRef.current.isAnswerVisible = v; setIsAnswerVisible(v); renderScene(); };", sync_mod)


# Modify problem generation
problem_gen_mod = """    // --- Build Object (Problem) ---
    const problemWrapper = new THREE.Group();
    const objectGroup = new THREE.Group();

    // Cube 1 (Base)
    const cube1Group = new THREE.Group();
    const matA = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.1 });
    cube1Group.add(new THREE.Mesh(geoA, matA));
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    addEdgesToGroup(cube1Group, new THREE.EdgesGeometry(geoA), blackMat);
    
    // Hints for the 45-degree cubes
    r.hintGroup = new THREE.Group();
    const hintMat = new THREE.MeshBasicMaterial({ color: 0xff9500 });
    const s = size / 2;
    
    // Only 2 corners now
    const corners = [
      { px: s, py: s, angle: Math.PI / 4 },
      { px: -s, py: s, angle: Math.PI / 4 + Math.PI / 2 }
    ];

    corners.forEach(corner => {
      const { px, py, angle } = corner;
      
      const hintEdge = new THREE.Mesh(cylGeo, hintMat);
      hintEdge.position.set(px, py, 0);
      hintEdge.scale.set(1.5, 1.5, size);
      r.hintGroup!.add(hintEdge);

      const hintFlap = new THREE.Mesh(cylGeo, hintMat);
      const hDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
      const hLen = 1.0;
      hintFlap.position.copy(new THREE.Vector3(px, py, 0)).addScaledVector(hDir, hLen / 2);
      hintFlap.scale.set(1.5, 1.5, hLen);
      hintFlap.lookAt(new THREE.Vector3(px, py, 0).addScaledVector(hDir, hLen));
      r.hintGroup!.add(hintFlap);
    });

    cube1Group.add(r.hintGroup);
    objectGroup.add(cube1Group);"""
content = re.sub(r'    // --- Build Object \(Problem\) ---[\s\S]*?    objectGroup\.add\(cube1Group\);', problem_gen_mod, content)


# Fix the trackGroup and answerGroup additions
track_mod = """    r.trackGroup.visible = visRef.current.isAnswerVisible;
    problemWrapper.add(r.trackGroup);"""
content = content.replace("    r.trackGroup.visible = visRef.current.isAnswerVisible;\n    r.targetGroup.add(r.trackGroup);", track_mod)

ans_mod = """    r.answerGroup.visible = visRef.current.isAnswerVisible;
    problemWrapper.add(r.answerGroup);

    // Randomize orientation
    problemWrapper.rotation.x = Math.floor(Math.random() * 4) * Math.PI / 2;
    problemWrapper.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
    problemWrapper.rotation.z = Math.floor(Math.random() * 4) * Math.PI / 2;
    
    r.targetGroup.add(problemWrapper);"""
content = content.replace("    r.answerGroup.visible = visRef.current.isAnswerVisible;\n    r.targetGroup.add(r.answerGroup);", ans_mod)


obj_mod = """    // Center the whole object approximately
    objectGroup.position.set(0, -size / 4, 0);

    // Target Group (only lines, faint faces, and hints)
    problemWrapper.add(objectGroup);"""
content = content.replace("    // Center the whole object approximately\n    objectGroup.position.set(0, -size / 4, 0);\n\n    // Target Group (only lines, faint faces, and hints)\n    r.targetGroup.add(objectGroup);", obj_mod)


# Add UI checkbox
ui_mod = """        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isHintVisible} onChange={e => setHintSync(e.target.checked)} />
            ヒント(45度線)を表示
          </label>
        </div>
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>"""
content = content.replace("        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>\n          <label>パースの強さ", ui_mod + "\n          <label>パースの強さ")

with open('src/components/DiagonalCubeMode.tsx', 'w') as f:
    f.write(content)

