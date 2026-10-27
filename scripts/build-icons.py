"""Convert the generated master artwork into platform icon containers."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
master = Image.open(root / 'build/brand/castpanel-master.png').convert('RGBA')
assert master.width == master.height and master.getextrema()[3][0] == 0
sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256, 512, 1024]
(root / 'build/icons').mkdir(exist_ok=True)
for size in sizes:
    master.resize((size, size), Image.Resampling.LANCZOS).save(root / f'build/icons/{size}x{size}.png')
master.resize((1024, 1024), Image.Resampling.LANCZOS).save(root / 'build/icon.png')
master.save(root / 'build/icon.ico', format='ICO', sizes=[(s, s) for s in sizes if s <= 256])
master.resize((1024, 1024), Image.Resampling.LANCZOS).save(root / 'build/icon.icns', format='ICNS')
for folder in ['src/renderer/assets', 'website/dist/assets']:
    directory = root / folder
    directory.mkdir(parents=True, exist_ok=True)
    master.resize((512, 512), Image.Resampling.LANCZOS).save(directory / 'castpanel-icon.png')
master.resize((32, 32), Image.Resampling.LANCZOS).save(root / 'website/dist/favicon.png')
print('Created ICO, ICNS and PNG icons from the generated master.')
