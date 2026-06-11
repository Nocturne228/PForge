from pathlib import Path

from PIL import Image

from pixelforge_core.image.common import (
    filter_valid_images,
    jpeg_bytes,
    list_images,
    output_dir,
    print_corrupted,
    resolve_image_file,
    save_image,
)
from pixelforge_core.utils import OperationResult, available_output_path, log


def image_compress(folder_path, file_arg=None, quality=75, max_side=None, target_kb=None, best_quality=False):
    root = Path(folder_path).expanduser().resolve()
    quality = 95 if best_quality else int(quality)
    if quality < 1 or quality > 100:
        raise ValueError("压缩质量必须在 1 到 100 之间")
    max_side = int(max_side) if max_side else None
    target_bytes = int(target_kb) * 1024 if target_kb else None
    if target_bytes is not None and target_bytes <= 0:
        raise ValueError("目标大小必须大于 0 KB")
    images = [resolve_image_file(root, file_arg)] if file_arg else list_images(root)
    if not images:
        log.info("未找到任何图片文件。")
        return OperationResult()

    result = OperationResult(total=len(images))
    loaded, corrupted = filter_valid_images(images)
    log.info(f"图片压缩中 ({len(images)} 张)...")
    for image_path, img in loaded:
        with img:
            if max_side and max(img.size) > max_side:
                img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
            output = available_output_path(output_dir(root) / f"{image_path.stem}_compressed.jpg")
            if target_bytes:
                best = None
                low, high = 1, quality
                while low <= high:
                    mid = (low + high) // 2
                    data = jpeg_bytes(img, mid)
                    if len(data) <= target_bytes:
                        best = (mid, data)
                        low = mid + 1
                    else:
                        high = mid - 1
                if best is None:
                    data = jpeg_bytes(img, 1)
                    chosen_quality = 1
                    log.info(f"\n  [提示] {image_path.name} 即使最低质量也可能超过目标大小")
                else:
                    chosen_quality, data = best
                output.write_bytes(data)
                log.progress(
                    f"  当前: {image_path.name} -> {output.name} "
                    f"({output.stat().st_size / 1024:.1f} KB, q={chosen_quality})"
                )
            else:
                save_image(img, output, quality=quality)
                log.progress(f"  当前: {image_path.name} -> {output.name}")
            result.success += 1
            result.outputs.append(output)
    log.done(f"\r图片压缩完成，成功 {result.success}/{len(images)} 张")
    result.corrupted = corrupted
    print_corrupted(corrupted)
    return result
