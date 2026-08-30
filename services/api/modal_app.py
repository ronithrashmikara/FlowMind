from pathlib import Path
import modal

ROOT = Path(__file__).parent
image = modal.Image.debian_slim(python_version="3.12").pip_install_from_requirements(str(ROOT / "requirements.txt")).add_local_dir(str(ROOT), remote_path="/root/flowmind")
volume = modal.Volume.from_name("flowmind-data", create_if_missing=True)
app = modal.App("flowmind-api")


@app.function(image=image, volumes={"/data": volume}, timeout=300, scaledown_window=300)
@modal.asgi_app()
def fastapi_app():
    import os
    import sys
    sys.path.insert(0, "/root/flowmind")
    os.environ["FLOWMIND_DATA_DIR"] = "/data"
    from main import app as api
    return api
