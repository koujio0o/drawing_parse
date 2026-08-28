import re

with open('src/components/EyeLevelMode.tsx', 'r') as f:
    content = f.read()

# Add isSymmetrical state
state_block = """  const [isSymmetrical, setIsSymmetrical] = useState(() => {
    const saved = localStorage.getItem('eyeLevelIsSymmetrical');
    return saved ? saved === 'true' : true;
  });"""
content = re.sub(r'  const \[eyeLineLengthUI, setEyeLineLengthUI\] = useState\(\(\) => \{[\s\S]*?\}\);\n',
                 r"  const [eyeLineLengthUI, setEyeLineLengthUI] = useState(() => {\n    const saved = localStorage.getItem('eyeLevelEyeLineLengthUI');\n    return saved ? parseInt(saved, 10) : 30;\n  });\n\n" + state_block + "\n", content)

# Add to sr.current
content = re.sub(r'    showFullBottomEdge, eyeLineLengthUI,', r'    showFullBottomEdge, eyeLineLengthUI, isSymmetrical,', content)

# Add setIsSymmetricalSync
sync_block = """  const setIsSymmetricalSync = (v: boolean) => {
    sr.current.isSymmetrical = v;
    setIsSymmetrical(v);
    localStorage.setItem('eyeLevelIsSymmetrical', v.toString());
    generateRandomScene(true);
  };"""
content = re.sub(r'  const setEyeLineLengthUISync = \(v: number\) => \{[\s\S]*?  \};\n',
                 r"  const setEyeLineLengthUISync = (v: number) => {\n    sr.current.eyeLineLengthUI = v;\n    setEyeLineLengthUI(v);\n    localStorage.setItem('eyeLevelEyeLineLengthUI', v.toString());\n    generateRandomScene(true);\n  };\n\n" + sync_block + "\n", content)


# Modify generateRandomScene
rot_logic = """    const S = sr.current.S;
    const yOffset = sr.current.cubeYOffset;

    let rotY = -Math.PI / 4;
    if (!sr.current.isSymmetrical) {
      const isSteep = Math.random() > 0.5;
      const angleDeg = isSteep ? (Math.random() * 20 + 60) : (Math.random() * 20 + 10);
      rotY = -angleDeg * Math.PI / 180;
    }

    const allCubesGroup = new THREE.Group();
    allCubesGroup.position.y = yOffset;
    
    allCubesGroup.rotation.y = rotY;"""
content = re.sub(r'    const S = sr\.current\.S;\n    const yOffset = sr\.current\.cubeYOffset;\n\n    const allCubesGroup = new THREE\.Group\(\);\n    allCubesGroup\.position\.y = yOffset;\n    \n    allCubesGroup\.rotation\.y = -Math\.PI / 4;', rot_logic, content)


# Modify applyAxisAngle
content = re.sub(r'pHintLocal\.applyAxisAngle\(new THREE\.Vector3\(0, 1, 0\), -Math\.PI / 4\);', r'pHintLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);', content)

# Modify answerGroup rotation
content = re.sub(r'r\.answerGroup!\.rotation\.y = -Math\.PI / 4;', r'r.answerGroup!.rotation.y = rotY;', content)


# Add to UI
ui_block = """        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isSymmetrical} onChange={e => setIsSymmetricalSync(e.target.checked)} />
            左右対称
          </label>
        </div>"""
content = re.sub(r'      \{\/\* Top-left: perspective sliders \*\/\}\n      <div className="glass-panel" style=\{\{ position: \'absolute\', top: 20, left: 20, padding: 16, zIndex: 20, width: 220 \}\}>\n',
                 r"      {/* Top-left: perspective sliders */}\n      <div className=\"glass-panel\" style={{ position: 'absolute', top: 20, left: 20, padding: 16, zIndex: 20, width: 220 }}>\n" + ui_block + "\n", content)

with open('src/components/EyeLevelMode.tsx', 'w') as f:
    f.write(content)

