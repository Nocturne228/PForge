from pathlib import Path

from pixelforge_core.image.common import load_image, output_dir, resolve_image_file, save_image
from pixelforge_core.utils import OperationResult, available_output_path, log, resolve_output_path


def image_crop(folder_path, file_arg, crop_box, output_arg=None):
    root = Path(folder_path).expanduser().resolve()
    image_path = resolve_image_file(root, file_arg)

    try:
        x = float(crop_box["x"])
        y = float(crop_box["y"])
        w = float(crop_box["width"])
        h = float(crop_box["height"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("裁剪区域参数无效") from exc

    if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > 1 or y + h > 1:
        raise ValueError("裁剪区域超出图片范围")

    with load_image(image_path) as image:
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
            output = available_output_path(output_dir(root) / f"{image_path.stem}_crop.png")
        save_image(cropped, output)

    log.done(f"已保存裁剪图片: {output}")
    return OperationResult(total=1, success=1, outputs=[output])
