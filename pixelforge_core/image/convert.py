from pathlib import Path

from pixelforge_core.image.common import (
    filter_valid_images,
    list_images,
    output_dir,
    print_corrupted,
    resolve_image_file,
    save_image,
)
from pixelforge_core.utils import OperationResult, available_output_path, log


def image_convert(folder_path, file_arg=None, target_format="png"):
    root = Path(folder_path).expanduser().resolve()
    target_format = target_format.lower().lstrip(".")
    if target_format not in {"png", "jpg", "jpeg", "webp"}:
        raise ValueError("目标格式仅支持 png、jpg、webp")
    ext = ".jpg" if target_format == "jpeg" else f".{target_format}"
    images = [resolve_image_file(root, file_arg)] if file_arg else list_images(root)
    if not images:
        log.info("未找到任何图片文件。")
        return OperationResult()

    result = OperationResult(total=len(images))
    loaded, corrupted = filter_valid_images(images)
    log.info(f"图片转换中 ({len(images)} 张)...")
    for image_path, img in loaded:
        with img:
            output = available_output_path(output_dir(root) / f"{image_path.stem}{ext}")
            save_image(img, output)
            result.success += 1
            result.outputs.append(output)
            log.progress(f"  当前: {image_path.name} -> {output.name}")
    log.done(f"\r图片转换完成，成功 {result.success}/{len(images)} 张")
    result.corrupted = corrupted
    print_corrupted(corrupted)
    return result
