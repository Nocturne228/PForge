import io
from pathlib import Path

from PIL import Image, ImageOps

from pixelforge_core.config import IMAGE_EXTENSIONS, OUTPUT_DIR_IMAGES
from pixelforge_core.utils import log, natural_key


def output_dir(root):
    path = Path(root).expanduser().resolve() / OUTPUT_DIR_IMAGES
    path.mkdir(parents=True, exist_ok=True)
    return path


def resolve_image_file(root, file_arg):
    if not file_arg:
        raise ValueError("需要指定图片文件")
    root = Path(root).expanduser().resolve()
    candidate = Path(file_arg).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate
    candidate = candidate.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError("图片文件必须位于目标文件夹内") from exc
    if not candidate.is_file() or candidate.suffix.lower() not in IMAGE_EXTENSIONS:
        raise FileNotFoundError(f"图片文件不存在: {candidate}")
    return candidate


def list_images(root):
    root = Path(root).expanduser().resolve()
    images = [
        p for p in root.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return sorted(images, key=natural_key)


def save_image(image, output_path, quality=90):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    ext = output_path.suffix.lower()
    if ext in {".jpg", ".jpeg"}:
        image = image.convert("RGB")
        image.save(output_path, "JPEG", quality=quality, optimize=True)
    elif ext == ".webp":
        image.save(output_path, "WEBP", quality=quality, method=6)
    else:
        image.save(output_path)
    return output_path


def jpeg_bytes(image, quality):
    buf = io.BytesIO()
    image.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def load_image(path):
    image = Image.open(path)
    return ImageOps.exif_transpose(image)


def try_load_image(path):
    try:
        image = Image.open(path)
        image.verify()
        image = Image.open(path)
        image = ImageOps.exif_transpose(image)
        return image, None
    except Exception as e:
        return None, str(e)


def filter_valid_images(paths):
    """Load and validate image paths. Returns (loaded, corrupted).

    loaded: list of (path, RGB Image) tuples
    corrupted: list of paths that failed to load
    """
    loaded = []
    corrupted = []
    for path in paths:
        img, err = try_load_image(path)
        if err:
            corrupted.append(path)
            log.info(f"  [跳过] 损坏文件: {path.name} ({err})")
        else:
            loaded.append((path, img.convert("RGB")))
    return loaded, corrupted


def print_corrupted(files):
    if not files:
        return
    log.info(f"\n损坏文件 ({len(files)}):")
    for p in files:
        log.info(f"  - {p.name}")
