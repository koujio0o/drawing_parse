import re

files = ['src/components/SphereMode.tsx', 'src/components/SubtractionMode.tsx']

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    content = content.replace("const w = canvas.width;", "const w = canvas.clientWidth;")
    content = content.replace("const h = canvas.height;", "const h = canvas.clientHeight;")
    content = content.replace("* canvas.width", "* canvas.clientWidth")
    content = content.replace("* canvas.height", "* canvas.clientHeight")
    content = content.replace("canvas.width, canvas.height", "canvas.clientWidth, canvas.clientHeight")

    with open(file, 'w') as f:
        f.write(content)
