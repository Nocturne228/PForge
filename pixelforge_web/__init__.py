from flask import Flask

from pixelforge_web.config import ensure_default_dirs, get_allowed_roots, get_home_dir


def create_app():
    app = Flask(__name__)

    home = get_home_dir()
    ensure_default_dirs(home)
    app.config["PIXELFORGE_HOME"] = home
    app.config["PIXELFORGE_ALLOWED_ROOTS"] = get_allowed_roots(home)

    from pixelforge_web.image_routes import image_api_bp
    from pixelforge_web.pdf_routes import pdf_api_bp
    from pixelforge_web.routes import api_bp, main_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(pdf_api_bp, url_prefix="/api")
    app.register_blueprint(image_api_bp, url_prefix="/api")

    return app
