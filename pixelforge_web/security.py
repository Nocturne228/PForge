from pathlib import Path

from flask import current_app, jsonify


def resolve_allowed_path(path):
    home = current_app.config["PIXELFORGE_HOME"]
    allowed_roots = current_app.config["PIXELFORGE_ALLOWED_ROOTS"]
    p = Path(path or home).expanduser().resolve()
    for root in allowed_roots:
        try:
            p.relative_to(root)
            return p
        except ValueError:
            continue
    roots = "、".join(str(root) for root in allowed_roots)
    raise PermissionError(f"路径不在允许访问范围内: {p}。允许范围: {roots}")


def path_error_response(exc):
    status = 403 if isinstance(exc, PermissionError) else 400
    return jsonify({"error": str(exc)}), status
