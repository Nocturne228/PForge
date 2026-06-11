from pathlib import Path

from PIL import Image

from pixelforge_core.image.common import load_image, output_dir, resolve_image_file, save_image
from pixelforge_core.utils import OperationResult, available_output_path, log


def image_resize(folder_path, file_arg, width, height, mode="pixel", keep_ratio=False, no_enlarge=False):
    root = Path(folder_path).expanduser().resolve()
    image_path = resolve_image_file(root, file_arg)

    with load_image(image_path) as image:
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
            output_dir(root) / f"{image_path.stem}_{target_w}x{target_h}{image_path.suffix}"
        )
        save_image(resized, output)

    log.done(f"已保存拉伸图片: {output} ({target_w}x{target_h})")
    return OperationResult(total=1, success=1, outputs=[output])
