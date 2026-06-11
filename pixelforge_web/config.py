import json
import os
from pathlib import Path

from pixelforge_core.config import IMAGE_EXTENSIONS

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = _PROJECT_ROOT / "config"
CONFIG_FILE = CONFIG_DIR / "settings.json"
_DEFAULT_HOME = "/tmp"
_ENV_HOME = "PIXELFORGE_HOME"
_ENV_PERSIST_HOME = "PIXELFORGE_PERSIST_HOME"

VISIBLE_FILE_EXTENSIONS = {".pdf", ".zip"} | IMAGE_EXTENSIONS
MAX_SCAN_RESULTS = 5000


def _load_config():
    try:
        with open(CONFIG_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_config(data):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def get_home_dir():
    env_home = os.environ.get(_ENV_HOME)
    if env_home:
        p = Path(env_home).expanduser().resolve()
        p.mkdir(parents=True, exist_ok=True)
        if os.environ.get(_ENV_PERSIST_HOME) == "1":
            _save_config({"home": str(p)})
        return str(p)

    cfg = _load_config()
    raw = cfg.get("home", _DEFAULT_HOME)
    return str(Path(raw).expanduser().resolve())


def ensure_default_dirs(home_dir):
    for path in (Path(home_dir), Path(home_dir, ".work")):
        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass


def get_allowed_roots(home_dir):
    default_roots = [Path(home_dir), _PROJECT_ROOT]
    return [
        Path(p).expanduser().resolve()
        for p in os.environ.get(
            "PIXELFORGE_ALLOWED_ROOTS",
            os.pathsep.join(str(p) for p in default_roots),
        ).split(os.pathsep)
        if p
    ]



