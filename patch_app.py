import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add import
if 'import SymmetryMode from' not in content:
    content = content.replace("import EyeLevelMode from './components/EyeLevelMode';", "import EyeLevelMode from './components/EyeLevelMode';\nimport SymmetryMode from './components/SymmetryMode';")

# Add to useState
content = content.replace("'ratio_plane' | 'eye_level'", "'ratio_plane' | 'eye_level' | 'symmetry'")

# Add button
button_html = """        <button 
          className={`glass-button ${activeTab === 'symmetry' ? 'btn-primary' : 'btn-light'}`}
          onClick={() => setActiveTab('symmetry')}
          style={{ padding: '8px 12px', borderRadius: '24px', boxShadow: 'none' }}
        >
          対称描画
        </button>
      </header>"""
content = content.replace("      </header>", button_html)

# Add component
comp_html = """        {activeTab === 'eye_level' && <EyeLevelMode />}
        {activeTab === 'symmetry' && <SymmetryMode />}"""
content = content.replace("{activeTab === 'eye_level' && <EyeLevelMode />}", comp_html)


with open('src/App.tsx', 'w') as f:
    f.write(content)

