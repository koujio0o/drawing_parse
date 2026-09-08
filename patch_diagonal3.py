import re

with open('src/components/DiagonalCubeMode.tsx', 'r') as f:
    content = f.read()

# Add UI checkbox as child of PerspectiveControls
ui_mod = """      <PerspectiveControls
        fov={cam.fov}
        rx={cam.rx}
        ry={cam.ry}
        onFovChange={cam.setFovSync}
        onRxChange={cam.setRxSync}
        onRyChange={cam.setRySync}
        isGridVisible={isGridVisible}
        onGridToggle={() => setGridSync(!isGridVisible)}
        isAnswerVisible={isAnswerVisible}
        onAnswerToggle={() => setAnswerSync(!isAnswerVisible)}
        onNextQuestion={generateRandomBlock}
        onClearAll={() => undoStack.clearAll(doRedraw)}
      >
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 'bold' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isHintVisible} onChange={e => setHintSync(e.target.checked)} />
            ヒント(45度線)を表示
          </label>
        </div>
      </PerspectiveControls>"""

content = re.sub(r'      <PerspectiveControls[\s\S]*?onClearAll=\{\(\) => undoStack\.clearAll\(doRedraw\)\}\n      />', ui_mod, content)

with open('src/components/DiagonalCubeMode.tsx', 'w') as f:
    f.write(content)

