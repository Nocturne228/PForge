import shutil
from pathlib import Path

from pypdf import PageObject, PdfReader, PdfWriter, Transformation
from tqdm import tqdm

from pixelforge_core.config import BACKUP_DIR_RESIZE, EXCLUDE_DIRS
from pixelforge_core.utils import OperationResult, resolve_pdf_file


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
        print(f"\n[错误] 处理文件失败 {input_path.name}: {e}", flush=True)
        return False


def _batch_resize(all_files, target_width_mm=210, target_height_mm=297, strip_mode=False):
    if not all_files:
        print("未找到需要处理的 PDF 文件。", flush=True)
        return OperationResult()

    all_files = sorted(all_files)

    print("=" * 48, flush=True)
    print(
        f"  模式: {'【条形漫画模式】（仅固定宽度）' if strip_mode else '【标准缩放模式】（固定宽高）'}",
        flush=True,
    )
    print(f"  目标宽度: {target_width_mm} mm", flush=True)
    if not strip_mode:
        print(f"  目标高度: {target_height_mm} mm", flush=True)
    print(f"  PDF 数量: {len(all_files)}", flush=True)
    print("=" * 48, flush=True)
    print("", flush=True)

    result = OperationResult(total=len(all_files))

    for pdf_path in tqdm(all_files, desc="尺寸缩放中"):
        current_backup_dir = pdf_path.parent / BACKUP_DIR_RESIZE
        backup_path = current_backup_dir / pdf_path.name

        if backup_path.exists():
            print(f"\n[跳过] 开启保护：{pdf_path.name}", flush=True)
            print(f"       -> 原因：专属备份目录 {current_backup_dir.name}/ 中已存在同名原文件")
            result.skipped += 1
            continue

        try:
            current_backup_dir.mkdir(exist_ok=True)
            pdf_path.rename(backup_path)

            status = _resize_single_pdf(
                input_path=backup_path,
                output_path=pdf_path,
                target_width_mm=target_width_mm,
                target_height_mm=target_height_mm,
                strip_mode=strip_mode,
            )

            if status:
                result.success += 1
                result.outputs.append(pdf_path)
            else:
                result.failed += 1
                if backup_path.exists():
                    backup_path.rename(pdf_path)

        except Exception as e:
            result.failed += 1
            print(f"\n[系统异常] 无法安全备份或处理 {pdf_path.name}: {e}", flush=True)
            if backup_path.exists() and not pdf_path.exists():
                backup_path.rename(pdf_path)

    print("", flush=True)
    print("=" * 48, flush=True)
    print("  任务执行完毕报告", flush=True)
    print("=" * 48, flush=True)
    print(f"  文件总数 : {result.total}", flush=True)
    print(f"  成功转换 : {result.success}（原名保存）", flush=True)
    print(f"  安全跳过 : {result.skipped}（备份目录已存在原文件）", flush=True)
    print(f"  处理失败 : {result.failed}", flush=True)
    print("=" * 48, flush=True)
    return result


def resize_folder(folder_path, target_width_mm=210, target_height_mm=297, strip_mode=False):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"路径不存在或不是一个有效的文件夹 -> {root}")

    all_files = [p for p in root.rglob("*.pdf") if not any(d in p.parts for d in EXCLUDE_DIRS)]

    if not all_files:
        print(f"未在目录 {root} 及其子目录下找到任何需要处理的 PDF 文件。", flush=True)
        return OperationResult()

    print(f"  扫描目录: {root}", flush=True)
    return _batch_resize(all_files, target_width_mm, target_height_mm, strip_mode)


def resize_file(folder_path, file_arg, target_width_mm=210, target_height_mm=297, strip_mode=False):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"路径不存在或不是一个有效的文件夹 -> {root}")
    pdf_path = resolve_pdf_file(root, file_arg, EXCLUDE_DIRS)
    print(f"  指定文件: {pdf_path.relative_to(root)}", flush=True)
    return _batch_resize([pdf_path], target_width_mm, target_height_mm, strip_mode)


def clean_resize_backups(folder_path):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"路径不存在或不是一个有效的文件夹 -> {root}")
    dirs = sorted(root.rglob(BACKUP_DIR_RESIZE))
    if not dirs:
        print(f"未找到任何 {BACKUP_DIR_RESIZE} 备份目录。", flush=True)
        return OperationResult()
    for d in dirs:
        shutil.rmtree(d)
        print(f"已删除备份目录: {d}", flush=True)
    print(f"\n共清理 {len(dirs)} 个 {BACKUP_DIR_RESIZE} 备份目录。", flush=True)
    return OperationResult(total=len(dirs), success=len(dirs))
