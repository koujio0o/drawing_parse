import re

with open('src/components/CircleMode.tsx', 'r') as f:
    content = f.read()

# Replace canvas.width -> canvas.clientWidth for coordinate mapping
content = content.replace("const w = canvas.width;", "const w = canvas.clientWidth;")
content = content.replace("const h = canvas.height;", "const h = canvas.clientHeight;")
content = content.replace("* canvas.width", "* canvas.clientWidth")
content = content.replace("* canvas.height", "* canvas.clientHeight")
content = content.replace("canvas.width, canvas.height", "canvas.clientWidth, canvas.clientHeight")
content = content.replace("cDraw.width = w; cDraw.height = h;", "cDraw.width = w; cDraw.height = h;") # not affected here

with open('src/components/CircleMode.tsx', 'w') as f:
    f.write(content)
