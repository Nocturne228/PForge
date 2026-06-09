import io
import json
import os
import queue
import threading
from contextlib import redirect_stdout
from pathlib import Path

from flask import Blueprint, Response, jsonify, render_template, request, send_file

from pdfkit_core.config import IMAGE_EXTENSIONS
from pdfkit_core import (
    DPI_PRESETS,
    EXCLUDE_DIRS,
    OperationResult,
    clean_page_backups,
    clean_resize_backups,
    clean_zip_files,
    crop_png,
    delete_file,
    delete_folder,
    extract_pdf,
    extract_png,
    image_compress,
    image_convert,
    image_crop,
    image_merge,
    image_resize,
    open_folder,
    render_page_image,
    resize_file,
    resize_folder,
    resolve_dpi,
    zip_file,
    zip_folder,
)
from pdfkit_core.converter import resolve_dpi as converter_resolve_dpi

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = _PROJECT_ROOT / "config"
CONFIG_FILE = CONFIG_DIR / "settings.json"
_DEFAULT_HOME = "/tmp"
_ENV_HOME = "PDFKIT_HOME"
_ENV_PERSIST_HOME = "PDFKIT_PERSIST_HOME"


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


def _get_home_dir():
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


HOME_DIR = _get_home_dir()


def _ensure_default_dirs():
    for path in (Path(HOME_DIR), Path(HOME_DIR, ".work")):
        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass


_ensure_default_dirs()

DEFAULT_ALLOWED_ROOTS = [Path(HOME_DIR), _PROJECT_ROOT]
ALLOWED_ROOTS = [
    Path(p).expanduser().resolve()
    for p in os.environ.get("PDFKIT_ALLOWED_ROOTS", os.pathsep.join(str(p) for p in DEFAULT_ALLOWED_ROOTS)).split(os.pathsep)
    if p
]

main_bp = Blueprint("main", __name__, template_folder="templates", static_folder="static")
api_bp = Blueprint("api", __name__)

_SENTINEL = object()
VISIBLE_FILE_EXTENSIONS = {".pdf", ".zip"} | IMAGE_EXTENSIONS


def _result_success(result):
    if isinstance(result, OperationResult):
        return result.ok
    return result is not False


def _result_payload(result):
    if not isinstance(result, OperationResult):
        return None
    return {
        "total": result.total,
        "success": result.success,
        "skipped": result.skipped,
        "failed": result.failed,
        "outputs": [str(p) for p in result.outputs],
    }


def _resolve_allowed_path(path):
    p = Path(path or HOME_DIR).expanduser().resolve()
    for root in ALLOWED_ROOTS:
        try:
            p.relative_to(root)
            return p
        except ValueError:
            continue
    roots = "、".join(str(root) for root in ALLOWED_ROOTS)
    raise PermissionError(f"路径不在允许访问范围内: {p}。允许范围: {roots}")


def _path_error_response(exc):
    status = 403 if isinstance(exc, PermissionError) else 400
    return jsonify({"error": str(exc)}), status


class _StreamBuf:
    """Thread-safe stdout capture.

    Newline output is appended as normal log lines. Carriage-return output is
    sent as a replaceable line so browser logs can update progress in place.
    """

    def __init__(self):
        self.q = queue.Queue()
        self._buf = ""

    def write(self, s):
        if not s:
            return
        for char in s:
            if char == "\r":
                line = self._buf.strip()
                if line:
                    self.q.put({"line": line, "replace": True})
                self._buf = ""
            elif char == "\n":
                line = self._buf.strip()
                if line:
                    self.q.put({"line": line, "replace": False})
                self._buf = ""
            else:
                self._buf += char

    def flush(self):
        if self._buf.strip():
            self.q.put({"line": self._buf.strip(), "replace": False})
            self._buf = ""


def _stream_task(func, *args, **kwargs):
    """Run func in a background thread, streaming its stdout as SSE events."""
    buf = _StreamBuf()

    def worker():
        try:
            with redirect_stdout(buf):
                result = func(*args, **kwargs)
                success = _result_success(result)
        except Exception as e:
            buf.write(f"[错误] {e}\n")
            success = False
            result = None
        buf.flush()
        buf.q.put(_SENTINEL)
        buf.success = success
        buf.result = _result_payload(result)

    t = threading.Thread(target=worker, daemon=True)
    t.start()

    def generate():
        while True:
            try:
                item = buf.q.get(timeout=120)
            except queue.Empty:
                yield f"data: {json.dumps({'line': '[超时] 操作超时'}, ensure_ascii=False)}\n\n"
                break
            if item is _SENTINEL:
                break
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"

        t.join(timeout=1)
        yield f"data: {json.dumps({'done': True, 'success': getattr(buf, 'success', False), 'result': getattr(buf, 'result', None)}, ensure_ascii=False)}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


def _capture(func, *args, **kwargs):
    """Non-streaming capture for simple endpoints (backward compat)."""
    buf = io.StringIO()
    success = True
    try:
        with redirect_stdout(buf):
            result = func(*args, **kwargs)
            if not _result_success(result):
                success = False
    except Exception as e:
        buf.write(f"\n[错误] {e}\n")
        success = False
    return success, buf.getvalue()


# ---- Pages ----


@main_bp.route("/")
def index():
    return render_template("index.html", home=HOME_DIR)


# ---- Non-streaming API ----


@api_bp.route("/browse", methods=["POST"])
def browse():
    data = request.get_json() or {}
    try:
        p = _resolve_allowed_path(data.get("path", HOME_DIR))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    if not p.is_dir():
        return jsonify({"error": "无法访问该目录"}), 400

    dirs = []
    files = []
    try:
        for item in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            if item.name.startswith("."):
                continue
            if item.is_dir():
                dirs.append({"name": item.name, "path": str(item)})
            else:
                ext = item.suffix.lower()
                if ext not in VISIBLE_FILE_EXTENSIONS:
                    continue
                files.append({
                    "name": item.name,
                    "path": str(item),
                    "ext": ext,
                    "size": item.stat().st_size,
                })
    except PermissionError:
        return jsonify({"error": "权限不足"}), 403

    return jsonify({"path": str(p), "name": p.name or str(p), "dirs": dirs, "files": files})


@api_bp.route("/scan", methods=["POST"])
def scan():
    data = request.get_json() or {}
    try:
        p = _resolve_allowed_path(data.get("path", HOME_DIR))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    if not p.is_dir():
        return jsonify({"error": "路径不存在或不是目录"}), 400

    pdfs = []
    zips = []
    for f in sorted(p.rglob("*.pdf")):
        if not any(d in f.parts for d in EXCLUDE_DIRS):
            pdfs.append({"name": f.name, "path": str(f), "rel": str(f.relative_to(p))})
    for f in sorted(p.glob("*.zip")):
        zips.append({"name": f.name, "path": str(f), "rel": str(f.relative_to(p))})

    return jsonify({"path": str(p), "pdfs": pdfs, "zips": zips})


@api_bp.route("/home", methods=["GET"])
def home():
    return jsonify({"home": HOME_DIR})


# ---- Streaming operation endpoints (SSE) ----


@api_bp.route("/resize", methods=["POST"])
def do_resize():
    data = request.get_json() or {}
    if not data.get("folder"):
        return jsonify({"error": "缺少 folder 参数"}), 400
    try:
        folder = str(_resolve_allowed_path(data.get("folder")))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    file_arg = data.get("file")
    width = float(data.get("width", 210))
    height = float(data.get("height", 297))
    strip = bool(data.get("strip", False))

    def run():
        if file_arg:
            return resize_file(folder, file_arg, width, height, strip)
        return resize_folder(folder, width, height, strip)

    return _stream_task(run)


@api_bp.route("/delete", methods=["POST"])
def do_delete():
    data = request.get_json() or {}
    if not data.get("folder"):
        return jsonify({"error": "缺少 folder 参数"}), 400
    try:
        folder = str(_resolve_allowed_path(data.get("folder")))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    file_arg = data.get("file")
    single = int(data["single"]) if data.get("single") is not None else None
    range_count = int(data["range"]) if data.get("range") is not None else None
    range_start = int(data["range_start"]) if data.get("range_start") is not None else None
    range_end = int(data["range_end"]) if data.get("range_end") is not None else None
    from_back = bool(data.get("back", False))

    if single is None and range_count is None and (range_start is None or range_end is None):
        return jsonify({"error": "请指定删除模式和页码参数"}), 400

    def run():
        if file_arg:
            return delete_file(folder, file_arg, single, range_count, range_start, range_end, from_back)
        return delete_folder(folder, single, range_count, range_start, range_end, from_back)

    return _stream_task(run)


@api_bp.route("/extract-png", methods=["POST"])
def do_extract_png():
    data = request.get_json() or {}
    folder = data.get("folder")
    file_arg = data.get("file")
    page = data.get("page")

    if not folder or not file_arg or page is None:
        return jsonify({"error": "缺少必要参数 (folder, file, page)"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    dpi = resolve_dpi(data.get("dpi_mode", "bw"))
    output_arg = data.get("output")

    return _stream_task(extract_png, folder, file_arg, int(page), output_arg, dpi=dpi)


@api_bp.route("/extract-pdf", methods=["POST"])
def do_extract_pdf():
    data = request.get_json() or {}
    folder = data.get("folder")
    file_arg = data.get("file")
    start = data.get("start")
    end = data.get("end")

    if not folder or not file_arg or start is None or end is None:
        return jsonify({"error": "缺少必要参数 (folder, file, start, end)"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    output_arg = data.get("output")

    return _stream_task(extract_pdf, folder, file_arg, int(start), int(end), output_arg)


@api_bp.route("/crop-png", methods=["POST"])
def do_crop_png():
    data = request.get_json() or {}
    folder = data.get("folder")
    file_arg = data.get("file")
    page = data.get("page")
    crop_box = data.get("crop")

    if not folder or not file_arg or page is None or not crop_box:
        return jsonify({"error": "缺少必要参数 (folder, file, page, crop)"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    dpi = int(data.get("dpi", 300))
    output_arg = data.get("output")

    return _stream_task(crop_png, folder, file_arg, int(page), crop_box, output_arg, dpi=dpi)


@api_bp.route("/image-resize", methods=["POST"])
def do_image_resize():
    data = request.get_json() or {}
    folder = data.get("folder")
    file_arg = data.get("file")
    mode = data.get("mode", "percent")
    width = data.get("width", data.get("width_pct"))
    height = data.get("height", data.get("height_pct"))
    if not folder or not file_arg or width is None or height is None:
        return jsonify({"error": "缺少必要参数 (folder, file, width, height)"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)
    return _stream_task(
        image_resize,
        folder,
        file_arg,
        float(width),
        float(height),
        mode=mode,
        keep_ratio=bool(data.get("keep_ratio", False)),
        no_enlarge=bool(data.get("no_enlarge", False)),
    )


@api_bp.route("/image-merge", methods=["POST"])
def do_image_merge():
    data = request.get_json() or {}
    folder = data.get("folder")
    if not folder:
        return jsonify({"error": "缺少 folder 参数"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)
    return _stream_task(image_merge, folder, data.get("mode", "grid"), bool(data.get("border", False)))


@api_bp.route("/image-crop", methods=["POST"])
def do_image_crop():
    data = request.get_json() or {}
    folder = data.get("folder")
    file_arg = data.get("file")
    crop_box = data.get("crop")
    if not folder or not file_arg or not crop_box:
        return jsonify({"error": "缺少必要参数 (folder, file, crop)"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)
    return _stream_task(image_crop, folder, file_arg, crop_box, data.get("output"))


@api_bp.route("/image-convert", methods=["POST"])
def do_image_convert():
    data = request.get_json() or {}
    folder = data.get("folder")
    if not folder:
        return jsonify({"error": "缺少 folder 参数"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)
    file_arg = data.get("file") if data.get("scope") == "selected" else None
    return _stream_task(image_convert, folder, file_arg, data.get("format", "png"))


@api_bp.route("/image-compress", methods=["POST"])
def do_image_compress():
    data = request.get_json() or {}
    folder = data.get("folder")
    if not folder:
        return jsonify({"error": "缺少 folder 参数"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)
    file_arg = data.get("file") if data.get("scope") == "selected" else None
    return _stream_task(
        image_compress,
        folder,
        file_arg,
        int(data.get("quality", 75)),
        data.get("max_side"),
        data.get("target_kb"),
        bool(data.get("best_quality", False)),
    )


@api_bp.route("/zip2pdf", methods=["POST"])
def do_zip2pdf():
    data = request.get_json() or {}
    if not data.get("folder"):
        return jsonify({"error": "缺少 folder 参数"}), 400
    try:
        folder = str(_resolve_allowed_path(data.get("folder")))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    file_arg = data.get("file")
    dpi = converter_resolve_dpi(data.get("dpi_mode", "bw"))

    def run():
        if file_arg:
            return zip_file(folder, file_arg, dpi=dpi)
        return zip_folder(folder, dpi=dpi)

    return _stream_task(run)


@api_bp.route("/clean", methods=["POST"])
def do_clean():
    data = request.get_json() or {}
    folder = data.get("folder")
    clean_type = data.get("type", "x_backup")

    if not folder:
        return jsonify({"error": "缺少 folder 参数"}), 400
    if clean_type not in {"x_backup", "y_backup", "zip", "all"}:
        return jsonify({"error": "未知清理类型"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    def run():
        if clean_type == "x_backup":
            return clean_resize_backups(folder)
        elif clean_type == "y_backup":
            return clean_page_backups(folder)
        elif clean_type == "zip":
            return clean_zip_files(folder)
        elif clean_type == "all":
            result = OperationResult()
            for clean_func in (clean_resize_backups, clean_page_backups, clean_zip_files):
                item = clean_func(folder)
                if isinstance(item, OperationResult):
                    result.total += item.total
                    result.success += item.success
                    result.skipped += item.skipped
                    result.failed += item.failed
                    result.outputs.extend(item.outputs)
            return result

    return _stream_task(run)


# ---- PDF preview ----


@api_bp.route("/pdf-file", methods=["GET"])
def serve_pdf_file():
    path = request.args.get("path", "")
    if not path:
        return jsonify({"error": "缺少 path 参数"}), 400

    try:
        p = _resolve_allowed_path(path)
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)
    if not p.is_file() or p.suffix.lower() != ".pdf":
        return jsonify({"error": "文件不存在或不是 PDF"}), 404

    return send_file(str(p), mimetype="application/pdf")


@api_bp.route("/page-image", methods=["GET"])
def serve_page_image():
    path = request.args.get("path", "")
    page = request.args.get("page", "1")
    dpi = request.args.get("dpi", "150")
    if not path:
        return jsonify({"error": "缺少 path 参数"}), 400

    try:
        p = _resolve_allowed_path(path)
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)
    if not p.is_file() or p.suffix.lower() != ".pdf":
        return jsonify({"error": "文件不存在或不是 PDF"}), 404

    try:
        root = str(p.parent)
        image = render_page_image(root, str(p), int(page), dpi=int(dpi))
        buf = io.BytesIO()
        image.save(buf, "PNG")
        buf.seek(0)
        return send_file(buf, mimetype="image/png")
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@api_bp.route("/image-file", methods=["GET"])
def serve_image_file():
    path = request.args.get("path", "")
    if not path:
        return jsonify({"error": "缺少 path 参数"}), 400
    try:
        p = _resolve_allowed_path(path)
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)
    if not p.is_file() or p.suffix.lower() not in VISIBLE_FILE_EXTENSIONS - {".pdf", ".zip"}:
        return jsonify({"error": "文件不存在或不是图片"}), 404
    return send_file(str(p))


@api_bp.route("/pdf-info", methods=["POST"])
def pdf_info():
    data = request.get_json() or {}
    path = data.get("path", "")
    if not path:
        return jsonify({"error": "缺少 path 参数"}), 400

    try:
        p = _resolve_allowed_path(path)
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)
    if not p.is_file() or p.suffix.lower() != ".pdf":
        return jsonify({"error": "文件不存在或不是 PDF"}), 404

    try:
        from pypdf import PdfReader

        reader = PdfReader(str(p))
        total_pages = len(reader.pages)
        if total_pages > 0:
            page = reader.pages[0]
            w = round(float(page.mediabox.width) / 2.83465, 1)
            h = round(float(page.mediabox.height) / 2.83465, 1)
        else:
            w, h = 0, 0

        return jsonify({
            "name": p.name,
            "path": str(p),
            "pages": total_pages,
            "width_mm": w,
            "height_mm": h,
            "size": p.stat().st_size,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/open-folder", methods=["POST"])
def do_open_folder():
    data = request.get_json() or {}
    folder = data.get("folder")
    if not folder:
        return jsonify({"error": "缺少 folder 参数"}), 400
    try:
        folder = str(_resolve_allowed_path(folder))
    except (PermissionError, OSError) as exc:
        return _path_error_response(exc)

    success, output = _capture(open_folder, folder)
    return jsonify({"success": success, "output": output})


@api_bp.route("/shutdown", methods=["POST"])
def shutdown():
    def do_shutdown():
        os._exit(0)

    import threading
    threading.Timer(0.5, do_shutdown).start()
    return jsonify({"success": True, "message": "服务正在关闭..."})
