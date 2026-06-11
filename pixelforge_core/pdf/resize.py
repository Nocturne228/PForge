from pathlib import Path

from pypdf import PageObject, PdfReader, PdfWriter, Transformation

from pixelforge_core.config import BACKUP_DIR_RESIZE, EXCLUDE_DIRS
from pixelforge_core.utils import OperationResult, batch_with_backup, clean_dirs_by_name, log, resolve_pdf_file


def _resize_single_pdf(input_path, output_path, target_width_mm=210, target_height_mm=297, strip_mode=False):
    MM_TO_POINTS = 2.83465
    target_w = target_width_mm * MM_TO_POINTS
    target_h = target_height_mm * MM_TO_POINTS

    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()

        for page in reader.pages:
            mediabox = page.mediabox
            current_w = float(mediabox.width)
            current_h = float(mediabox.height)

            x0 = float(mediabox.lower_left[0])
            y0 = float(mediabox.lower_left[1])

            if strip_mode:
                scale = target_w / current_w
                final_page_w = target_w
                final_page_h = current_h * scale
                tx = -(x0 * scale)
                ty = -(y0 * scale)
            else:
                scale = min(target_w / current_w, target_h / current_h)
                final_page_w = target_w
                final_page_h = target_h
                tx = (target_w - (current_w * scale)) / 2.0 - (x0 * scale)
                ty = (target_h - (current_h * scale)) / 2.0 - (y0 * scale)

            transform = Transformation().scale(scale, scale).translate(tx, ty)
            new_page = PageObject.create_blank_page(width=final_page_w, height=final_page_h)
            new_page.merge_transformed_page(page, transform)
            writer.add_page(new_page)

        with open(output_path, "wb") as f:
            writer.write(f)
        return True
    except Exception as e:
        log.error(f"处理文件失败 {input_path.name}: {e}")
        return False


def _batch_resize(all_files, target_width_mm=210, target_height_mm=297, strip_mode=False):
    def header(files):
        lines = [
            f"模式: {'【条形漫画模式】（仅固定宽度）' if strip_mode else '【标准缩放模式】（固定宽高）'}",
            f"目标宽度: {target_width_mm} mm",
        ]
        if not strip_mode:
            lines.append(f"目标高度: {target_height_mm} mm")
        lines.append(f"PDF 数量: {len(files)}")
        log.section(lines)

    def process(input_path, output_path):
        return _resize_single_pdf(input_path, output_path, target_width_mm, target_height_mm, strip_mode)

    return batch_with_backup(all_files, BACKUP_DIR_RESIZE, process, header_fn=header, desc="尺寸缩放中")


def resize_folder(folder_path, target_width_mm=210, target_height_mm=297, strip_mode=False):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"路径不存在或不是一个有效的文件夹 -> {root}")

    all_files = [p for p in root.rglob("*.pdf") if not any(d in p.parts for d in EXCLUDE_DIRS)]

    if not all_files:
        log.info(f"未在目录 {root} 及其子目录下找到任何需要处理的 PDF 文件。")
        return OperationResult()

    log.info(f"  扫描目录: {root}")
    return _batch_resize(all_files, target_width_mm, target_height_mm, strip_mode)


def resize_file(folder_path, file_arg, target_width_mm=210, target_height_mm=297, strip_mode=False):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"路径不存在或不是一个有效的文件夹 -> {root}")
    pdf_path = resolve_pdf_file(root, file_arg, EXCLUDE_DIRS)
    log.info(f"  指定文件: {pdf_path.relative_to(root)}")
    return _batch_resize([pdf_path], target_width_mm, target_height_mm, strip_mode)


def clean_resize_backups(folder_path):
    return clean_dirs_by_name(folder_path, BACKUP_DIR_RESIZE)
