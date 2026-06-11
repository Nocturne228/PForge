from pathlib import Path

from PIL import Image

from pixelforge_core.image.common import (
    filter_valid_images,
    list_images,
    output_dir,
    print_corrupted,
    save_image,
)
from pixelforge_core.utils import OperationResult, available_output_path, log


def image_merge(folder_path, mode="grid", border=False):
    root = Path(folder_path).expanduser().resolve()
    images = list_images(root)
    if not images:
        log.info("未找到任何图片文件。")
        return OperationResult()

    loaded, corrupted = filter_valid_images(images)

    if not loaded:
        log.info("没有可用的图片（所有文件均损坏）。")
        print_corrupted(corrupted)
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

    output = available_output_path(output_dir(root) / f"merged_{suffix}.png")
    save_image(canvas, output)
    log.done(f"已保存合并图片: {output}")
    print_corrupted(corrupted)
    return OperationResult(total=len(images), success=len(loaded), outputs=[output], corrupted=corrupted)
