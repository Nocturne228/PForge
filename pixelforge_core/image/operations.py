import io
import shutil
from pathlib import Path

from PIL import Image, ImageOps

from pixelforge_core.config import IMAGE_EXTENSIONS, OUTPUT_DIR_IMAGES
from pixelforge_core.utils import OperationResult, available_output_path, natural_key, resolve_output_path


def _output_dir(root):
    path = Path(root).expanduser().resolve() / OUTPUT_DIR_IMAGES
    path.mkdir(parents=True, exist_ok=True)
    return path


def _resolve_image_file(root, file_arg):
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


def _list_images(root):
    root = Path(root).expanduser().resolve()
    images = [
        p for p in root.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return sorted(images, key=natural_key)


def _save_image(image, output_path, quality=90):
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


def _jpeg_bytes(image, quality):
    buf = io.BytesIO()
    image.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def _load_image(path):
    image = Image.open(path)
    return ImageOps.exif_transpose(image)


def _try_load_image(path):
    try:
        image = Image.open(path)
        image.verify()
        image = Image.open(path)
        image = ImageOps.exif_transpose(image)
        return image, None
    except Exception as e:
        return None, str(e)


def _print_corrupted(files):
    if not files:
        return
    print(f"\n损坏文件 ({len(files)}):", flush=True)
    for p in files:
        print(f"  - {p.name}", flush=True)


def image_resize(folder_path, file_arg, width, height, mode="pixel", keep_ratio=False, no_enlarge=False):
    root = Path(folder_path).expanduser().resolve()
    image_path = _resolve_image_file(root, file_arg)

    with _load_image(image_path) as image:
        orig_w, orig_h = image.size
        if mode == "percent":
            w_pct = float(width)
            h_pct = float(height)
            if w_pct <= 0 or h_pct <= 0:
                raise ValueError("拉伸百分比必须大于 0")
            target_w = max(1, round(orig_w * w_pct / 100))
            target_h = max(1, round(orig_h * h_pct / 100))
        else:
            target_w = int(width)
            target_h = int(height)
            if target_w <= 0 or target_h <= 0:
                raise ValueError("目标宽高必须大于 0")
            if keep_ratio:
                scale = min(target_w / orig_w, target_h / orig_h)
                if no_enlarge:
                    scale = min(scale, 1)
                target_w = max(1, round(orig_w * scale))
                target_h = max(1, round(orig_h * scale))
            elif no_enlarge:
                target_w = min(target_w, orig_w)
                target_h = min(target_h, orig_h)

        if mode == "percent" and no_enlarge:
            target_w = min(target_w, orig_w)
            target_h = min(target_h, orig_h)

        resized = image.resize((target_w, target_h), Image.Resampling.LANCZOS)
        output = available_output_path(
            _output_dir(root) / f"{image_path.stem}_{target_w}x{target_h}{image_path.suffix}"
        )
        _save_image(resized, output)

    print(f"已保存拉伸图片: {output} ({target_w}x{target_h})", flush=True)
    return OperationResult(total=1, success=1, outputs=[output])


def image_merge(folder_path, mode="grid", border=False):
    root = Path(folder_path).expanduser().resolve()
    images = _list_images(root)
    if not images:
        print("未找到任何图片文件。", flush=True)
        return OperationResult()

    loaded = []
    corrupted = []
    for path in images:
        img, err = _try_load_image(path)
        if err:
            corrupted.append(path)
            print(f"  [跳过] 损坏文件: {path.name} ({err})", flush=True)
            continue
        loaded.append((path, img.convert("RGB")))

    if not loaded:
        print("没有可用的图片（所有文件均损坏）。", flush=True)
        _print_corrupted(corrupted)
        return OperationResult(total=len(images), corrupted=corrupted)

    border_size = 8 if border else 0
    border_color = (235, 235, 235)
    background = (255, 255, 255)

    if mode == "grid":
        columns = 3
        cell_w = max(img.width for _, img in loaded)
        cell_h = max(img.height for _, img in loaded)
        rows = (len(loaded) + columns - 1) // columns
        canvas_w = columns * cell_w + border_size * (columns + 1)
        canvas_h = rows * cell_h + border_size * (rows + 1)
        canvas = Image.new("RGB", (canvas_w, canvas_h), border_color if border else background)
        for index, (_, img) in enumerate(loaded):
            row = index // columns
            col = index % columns
            x = border_size + col * (cell_w + border_size) + (cell_w - img.width) // 2
            y = border_size + row * (cell_h + border_size) + (cell_h - img.height) // 2
            canvas.paste(img, (x, y))
        suffix = "grid"
    elif mode == "vertical":
        canvas_w = max(img.width for _, img in loaded) + border_size * 2
        canvas_h = sum(img.height for _, img in loaded) + border_size * (len(loaded) + 1)
        canvas = Image.new("RGB", (canvas_w, canvas_h), border_color if border else background)
        y = border_size
        for _, img in loaded:
            x = (canvas_w - img.width) // 2
            canvas.paste(img, (x, y))
            y += img.height + border_size
        suffix = "vertical"
    elif mode == "horizontal":
        canvas_w = sum(img.width for _, img in loaded) + border_size * (len(loaded) + 1)
        canvas_h = max(img.height for _, img in loaded) + border_size * 2
        canvas = Image.new("RGB", (canvas_w, canvas_h), border_color if border else background)
        x = border_size
        for _, img in loaded:
            y = (canvas_h - img.height) // 2
            canvas.paste(img, (x, y))
            x += img.width + border_size
        suffix = "horizontal"
    else:
        raise ValueError("未知合并方式")

    for _, img in loaded:
        img.close()

    output = available_output_path(_output_dir(root) / f"merged_{suffix}.png")
    _save_image(canvas, output)
    print(f"已保存合并图片: {output}", flush=True)
    _print_corrupted(corrupted)
    return OperationResult(total=len(images), success=len(loaded), outputs=[output], corrupted=corrupted)


def image_crop(folder_path, file_arg, crop_box, output_arg=None):
    root = Path(folder_path).expanduser().resolve()
    image_path = _resolve_image_file(root, file_arg)

    try:
        x = float(crop_box["x"])
        y = float(crop_box["y"])
        w = float(crop_box["width"])
        h = float(crop_box["height"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("裁剪区域参数无效") from exc

    if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > 1 or y + h > 1:
        raise ValueError("裁剪区域超出图片范围")

    with _load_image(image_path) as image:
        width, height = image.size
        box = (
            round(x * width),
            round(y * height),
            round((x + w) * width),
            round((y + h) * height),
        )
        cropped = image.crop(box)
        if output_arg:
            output = resolve_output_path(root, image_path, output_arg, f"{image_path.stem}_crop.png")
        else:
            output = available_output_path(_output_dir(root) / f"{image_path.stem}_crop.png")
        _save_image(cropped, output)

    print(f"已保存裁剪图片: {output}", flush=True)
    return OperationResult(total=1, success=1, outputs=[output])


def image_convert(folder_path, file_arg=None, target_format="png"):
    root = Path(folder_path).expanduser().resolve()
    target_format = target_format.lower().lstrip(".")
    if target_format not in {"png", "jpg", "jpeg", "webp"}:
        raise ValueError("目标格式仅支持 png、jpg、webp")
    ext = ".jpg" if target_format == "jpeg" else f".{target_format}"
    images = [_resolve_image_file(root, file_arg)] if file_arg else _list_images(root)
    if not images:
        print("未找到任何图片文件。", flush=True)
        return OperationResult()

    result = OperationResult(total=len(images))
    corrupted = []
    print(f"图片转换中 ({len(images)} 张)...", flush=True)
    for image_path in images:
        img, err = _try_load_image(image_path)
        if err:
            corrupted.append(image_path)
            print(f"  [跳过] 损坏文件: {image_path.name} ({err})", flush=True)
            continue
        with img:
            output = available_output_path(_output_dir(root) / f"{image_path.stem}{ext}")
            _save_image(img, output)
            result.success += 1
            result.outputs.append(output)
            print(f"\r  当前: {image_path.name} -> {output.name}", end="\r", flush=True)
    print(f"\r图片转换完成，成功 {result.success}/{len(images)} 张", flush=True)
    result.corrupted = corrupted
    _print_corrupted(corrupted)
    return result


def image_compress(folder_path, file_arg=None, quality=75, max_side=None, target_kb=None, best_quality=False):
    root = Path(folder_path).expanduser().resolve()
    quality = 95 if best_quality else int(quality)
    if quality < 1 or quality > 100:
        raise ValueError("压缩质量必须在 1 到 100 之间")
    max_side = int(max_side) if max_side else None
    target_bytes = int(target_kb) * 1024 if target_kb else None
    if target_bytes is not None and target_bytes <= 0:
        raise ValueError("目标大小必须大于 0 KB")
    images = [_resolve_image_file(root, file_arg)] if file_arg else _list_images(root)
    if not images:
        print("未找到任何图片文件。", flush=True)
        return OperationResult()

    result = OperationResult(total=len(images))
    corrupted = []
    print(f"图片压缩中 ({len(images)} 张)...", flush=True)
    for image_path in images:
        img, err = _try_load_image(image_path)
        if err:
            corrupted.append(image_path)
            print(f"  [跳过] 损坏文件: {image_path.name} ({err})", flush=True)
            continue
        with img:
            if max_side and max(img.size) > max_side:
                img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
            output = available_output_path(_output_dir(root) / f"{image_path.stem}_compressed.jpg")
            if target_bytes:
                best = None
                low, high = 1, quality
                while low <= high:
                    mid = (low + high) // 2
                    data = _jpeg_bytes(img, mid)
                    if len(data) <= target_bytes:
                        best = (mid, data)
                        low = mid + 1
                    else:
                        high = mid - 1
                if best is None:
                    data = _jpeg_bytes(img, 1)
                    chosen_quality = 1
                    print(f"\n  [提示] {image_path.name} 即使最低质量也可能超过目标大小", flush=True)
                else:
                    chosen_quality, data = best
                output.write_bytes(data)
                print(
                    f"\r  当前: {image_path.name} -> {output.name} "
                    f"({output.stat().st_size / 1024:.1f} KB, q={chosen_quality})",
                    end="\r",
                    flush=True,
                )
            else:
                _save_image(img, output, quality=quality)
                print(f"\r  当前: {image_path.name} -> {output.name}", end="\r", flush=True)
            result.success += 1
            result.outputs.append(output)
    print(f"\r图片压缩完成，成功 {result.success}/{len(images)} 张", flush=True)
    result.corrupted = corrupted
    _print_corrupted(corrupted)
    return result


def clean_image_outputs(folder_path):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"路径不存在或不是一个有效的文件夹 -> {root}")
    dirs = sorted(root.rglob(OUTPUT_DIR_IMAGES))
    if not dirs:
        print(f"未找到任何 {OUTPUT_DIR_IMAGES} 输出目录。", flush=True)
        return OperationResult()
    for d in dirs:
        shutil.rmtree(d)
        print(f"已删除输出目录: {d}", flush=True)
    print(f"\n共清理 {len(dirs)} 个 {OUTPUT_DIR_IMAGES} 输出目录。", flush=True)
    return OperationResult(total=len(dirs), success=len(dirs))
