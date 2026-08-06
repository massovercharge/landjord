import sys
try:
    from PIL import Image
    img_path = '/home/debian/.gemini/antigravity-ide/brain/0b3b6d03-0b64-4600-b727-2c3e91afb2c9/pwa_app_icon_1786003062581.png'
    img = Image.open(img_path)
    img.resize((192, 192)).save('/home/debian/landjord/frontend/public/icon-192.png')
    img.resize((512, 512)).save('/home/debian/landjord/frontend/public/icon-512.png')
    img.resize((192, 192)).save('/home/debian/landjord/frontend/public/apple-touch-icon.png')
    print("Images resized successfully.")
except ImportError:
    print("PIL not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image
    img_path = '/home/debian/.gemini/antigravity-ide/brain/0b3b6d03-0b64-4600-b727-2c3e91afb2c9/pwa_app_icon_1786003062581.png'
    img = Image.open(img_path)
    img.resize((192, 192)).save('/home/debian/landjord/frontend/public/icon-192.png')
    img.resize((512, 512)).save('/home/debian/landjord/frontend/public/icon-512.png')
    img.resize((192, 192)).save('/home/debian/landjord/frontend/public/apple-touch-icon.png')
    print("Images resized successfully after installing Pillow.")
