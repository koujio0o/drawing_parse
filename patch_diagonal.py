import re

with open('src/components/DiagonalCubeMode.tsx', 'r') as f:
    content = f.read()

# We need to replace the hint generation, track line generation, and answer group generation.
# Let's find the exact blocks to replace.

block_to_replace = r"""    // Hints for the two 45-degree cubes
    const hintMat = new THREE.MeshBasicMaterial\(\{ color: 0xff9500 \}\); // Orange for hint
    
    // Hint 1: Right-top edge \(\+45 deg\)
    const hint1Edge = new THREE.Mesh\(cylGeo, hintMat\);
    hint1Edge.position.set\(size / 2, size / 2, 0\);
    hint1Edge.scale.set\(1.5, 1.5, size\); // slightly thicker
    cube1Group.add\(hint1Edge\);

    const hint1Flap = new THREE.Mesh\(cylGeo, hintMat\);
    // short line pointing at 45 deg
    const h1Dir = new THREE.Vector3\(Math.cos\(Math.PI / 4\), Math.sin\(Math.PI / 4\), 0\).normalize\(\);
    const h1Len = 1.0;
    hint1Flap.position.copy\(new THREE.Vector3\(size / 2, size / 2, 0\)\).addScaledVector\(h1Dir, h1Len / 2\);
    hint1Flap.scale.set\(1.5, 1.5, h1Len\);
    hint1Flap.lookAt\(new THREE.Vector3\(size / 2, size / 2, 0\).addScaledVector\(h1Dir, h1Len\)\);
    cube1Group.add\(hint1Flap\);

    // Hint 2: Left-top edge \(135 deg / -45 deg from left\)
    const hint2Edge = new THREE.Mesh\(cylGeo, hintMat\);
    hint2Edge.position.set\(-size / 2, size / 2, 0\);
    hint2Edge.scale.set\(1.5, 1.5, size\);
    cube1Group.add\(hint2Edge\);

    const hint2Flap = new THREE.Mesh\(cylGeo, hintMat\);
    // short line pointing at 135 deg \(up and left\)
    const h2Dir = new THREE.Vector3\(-Math.cos\(Math.PI / 4\), Math.sin\(Math.PI / 4\), 0\).normalize\(\);
    const h2Len = 1.0;
    hint2Flap.position.copy\(new THREE.Vector3\(-size / 2, size / 2, 0\)\).addScaledVector\(h2Dir, h2Len / 2\);
    hint2Flap.scale.set\(1.5, 1.5, h2Len\);
    hint2Flap.lookAt\(new THREE.Vector3\(-size / 2, size / 2, 0\).addScaledVector\(h2Dir, h2Len\)\);
    cube1Group.add\(hint2Flap\);"""

new_hints = """    // Hints for the 45-degree cubes
    const hintMat = new THREE.MeshBasicMaterial({ color: 0xff9500 });
    const s = size / 2;
    
    const corners = [
      { px: s, py: s, angle: Math.PI / 4 },
      { px: -s, py: s, angle: Math.PI / 4 + Math.PI / 2 },
      { px: -s, py: -s, angle: Math.PI / 4 + Math.PI },
      { px: s, py: -s, angle: Math.PI / 4 + Math.PI * 1.5 }
    ];

    corners.forEach(corner => {
      const { px, py, angle } = corner;
      
      const hintEdge = new THREE.Mesh(cylGeo, hintMat);
      hintEdge.position.set(px, py, 0);
      hintEdge.scale.set(1.5, 1.5, size);
      cube1Group.add(hintEdge);

      const hintFlap = new THREE.Mesh(cylGeo, hintMat);
      const hDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
      const hLen = 1.0;
      hintFlap.position.copy(new THREE.Vector3(px, py, 0)).addScaledVector(hDir, hLen / 2);
      hintFlap.scale.set(1.5, 1.5, hLen);
      hintFlap.lookAt(new THREE.Vector3(px, py, 0).addScaledVector(hDir, hLen));
      cube1Group.add(hintFlap);
    });"""

content = re.sub(block_to_replace, new_hints, content)

# Remove the old L and s definitions, but wait, s is now defined above.
# We need to fix the track lines block.

track_block_to_replace = r"""    // --- Track Lines \(for answer mode extension\) ---
    r.trackGroup = new THREE.Group\(\);
    const trackMat = new THREE.MeshBasicMaterial\(\{ color: 0x007aff, transparent: true, opacity: 0.3 \}\);
    const L = 100;
    const s = size / 2;
    
    // Add extension lines for cube 1
    for \(let y of \[-s, s\]\) \{
      for \(let z of \[-s, s\]\) \{ addThickLine\(r.trackGroup, new THREE.Vector3\(-L, y, z\), new THREE.Vector3\(L, y, z\), trackMat\); \}
    \}
    for \(let x of \[-s, s\]\) \{
      for \(let z of \[-s, s\]\) \{ addThickLine\(r.trackGroup, new THREE.Vector3\(x, -L, z\), new THREE.Vector3\(x, L, z\), trackMat\); \}
    \}
    for \(let x of \[-s, s\]\) \{
      for \(let y of \[-s, s\]\) \{ addThickLine\(r.trackGroup, new THREE.Vector3\(x, y, -L\), new THREE.Vector3\(x, y, L\), trackMat\); \}
    \}

    // Function to add track lines for a rotated cube
    const addTrackLinesRotated = \(pivotX: number, pivotY: number, angleZ: number\) => \{
      // Cube local points: \[-s, s\]
      // transform: translate\(pivot\) \* rotZ\(angle\) \* translate\(s, s, 0\)
      const transform = \(v: THREE.Vector3\) => \{
        v.x \+= s; v.y \+= s;
        v.applyAxisAngle\(new THREE.Vector3\(0,0,1\), angleZ\);
        v.x \+= pivotX; v.y \+= pivotY;
        return v;
      \};
      
      for \(let y of \[-s, s\]\) \{
        for \(let z of \[-s, s\]\) \{
          addThickLine\(r.trackGroup!, transform\(new THREE.Vector3\(-L, y, z\)\), transform\(new THREE.Vector3\(L, y, z\)\), trackMat\);
        \}
      \}
      for \(let x of \[-s, s\]\) \{
        for \(let z of \[-s, s\]\) \{
          addThickLine\(r.trackGroup!, transform\(new THREE.Vector3\(x, -L, z\)\), transform\(new THREE.Vector3\(x, L, z\)\), trackMat\);
        \}
      \}
      for \(let x of \[-s, s\]\) \{
        for \(let y of \[-s, s\]\) \{
          addThickLine\(r.trackGroup!, transform\(new THREE.Vector3\(x, y, -L\)\), transform\(new THREE.Vector3\(x, y, L\)\), trackMat\);
        \}
      \}
    \};

    // Extension lines for Cube 2 \(Right\)
    addTrackLinesRotated\(s, s, Math.PI / 4\);
    // Extension lines for Cube 3 \(Left\) - angle is 90\+45 = 135 deg to rotate the bottom-left edge appropriately\?
    // Wait, if pivot is left-top \(-s, s\), we want the cube to go left and up.
    // A rotation of Math.PI/2 \+ Math.PI/4 \(135 deg\) around Z applied to \(x\+s, y\+s\) will make it go left-up.
    addTrackLinesRotated\(-s, s, Math.PI / 2 \+ Math.PI / 4\);"""

new_track_block = """    // --- Track Lines (for answer mode extension) ---
    r.trackGroup = new THREE.Group();
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x007aff, transparent: true, opacity: 0.3 });
    const L = 100;
    
    // Add extension lines for cube 1
    for (let y of [-s, s]) {
      for (let z of [-s, s]) { addThickLine(r.trackGroup, new THREE.Vector3(-L, y, z), new THREE.Vector3(L, y, z), trackMat); }
    }
    for (let x of [-s, s]) {
      for (let z of [-s, s]) { addThickLine(r.trackGroup, new THREE.Vector3(x, -L, z), new THREE.Vector3(x, L, z), trackMat); }
    }
    for (let x of [-s, s]) {
      for (let y of [-s, s]) { addThickLine(r.trackGroup, new THREE.Vector3(x, y, -L), new THREE.Vector3(x, y, L), trackMat); }
    }

    // Function to add track lines for a rotated cube
    const addTrackLinesRotated = (pivotX: number, pivotY: number, angleZ: number) => {
      const transform = (v: THREE.Vector3) => {
        v.x += s; v.y += s;
        v.applyAxisAngle(new THREE.Vector3(0,0,1), angleZ);
        v.x += pivotX; v.y += pivotY;
        return v;
      };
      
      for (let y of [-s, s]) {
        for (let z of [-s, s]) {
          addThickLine(r.trackGroup!, transform(new THREE.Vector3(-L, y, z)), transform(new THREE.Vector3(L, y, z)), trackMat);
        }
      }
      for (let x of [-s, s]) {
        for (let z of [-s, s]) {
          addThickLine(r.trackGroup!, transform(new THREE.Vector3(x, -L, z)), transform(new THREE.Vector3(x, L, z)), trackMat);
        }
      }
      for (let x of [-s, s]) {
        for (let y of [-s, s]) {
          addThickLine(r.trackGroup!, transform(new THREE.Vector3(x, y, -L)), transform(new THREE.Vector3(x, y, L)), trackMat);
        }
      }
    };

    corners.forEach(corner => {
      addTrackLinesRotated(corner.px, corner.py, corner.angle);
    });"""

content = re.sub(track_block_to_replace, new_track_block, content)


# Now replace Answer Group

answer_block_to_replace = r"""    // Answer Cube 2
    const aCube2GroupPivot = new THREE.Group\(\);
    aCube2GroupPivot.position.set\(size / 2, size / 2, 0\);
    const aCube2Group = new THREE.Group\(\);
    aCube2Group.position.set\(size / 2, size / 2, 0\);
    aCube2Group.add\(new THREE.Mesh\(geoA, answerSolidMat\)\);
    addEdgesToGroup\(aCube2Group, new THREE.EdgesGeometry\(geoA\), redMat\);
    aCube2GroupPivot.add\(aCube2Group\);
    aCube2GroupPivot.rotation.z = Math.PI / 4;
    r.answerGroup.add\(aCube2GroupPivot\);

    // Answer Cube 3
    const aCube3GroupPivot = new THREE.Group\(\);
    aCube3GroupPivot.position.set\(-size / 2, size / 2, 0\);
    const aCube3Group = new THREE.Group\(\);
    aCube3Group.position.set\(size / 2, size / 2, 0\); // same local offset
    aCube3Group.add\(new THREE.Mesh\(geoA, answerSolidMat\)\);
    addEdgesToGroup\(aCube3Group, new THREE.EdgesGeometry\(geoA\), redMat\);
    aCube3GroupPivot.add\(aCube3Group\);
    aCube3GroupPivot.rotation.z = Math.PI / 2 \+ Math.PI / 4; // 135 degrees
    r.answerGroup.add\(aCube3GroupPivot\);"""

new_answer_block = """    // Answer Cubes on 4 corners
    corners.forEach(corner => {
      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(corner.px, corner.py, 0);
      
      const cubeGroup = new THREE.Group();
      cubeGroup.position.set(s, s, 0);
      cubeGroup.add(new THREE.Mesh(geoA, answerSolidMat));
      addEdgesToGroup(cubeGroup, new THREE.EdgesGeometry(geoA), redMat);
      
      pivotGroup.add(cubeGroup);
      pivotGroup.rotation.z = corner.angle;
      r.answerGroup!.add(pivotGroup);
    });"""

content = re.sub(answer_block_to_replace, new_answer_block, content)

with open('src/components/DiagonalCubeMode.tsx', 'w') as f:
    f.write(content)

