import shutil
from pathlib import Path

from pdf2image import convert_from_path
from pypdf import PdfReader, PdfWriter
from tqdm import tqdm

from pdfkit_core.config import BACKUP_DIR_PAGE_OPS, DPI_PRESETS, EXCLUDE_DIRS
from pdfkit_core.utils import OperationResult, resolve_dpi as resolve_dpi_value, resolve_output_path, resolve_pdf_file

PDF_METADATA_FIELDS = {
    "title": "/Title",
    "author": "/Author",
    "subject": "/Subject",
    "keywords": "/Keywords",
    "creator": "/Creator",
    "producer": "/Producer",
}


def resolve_dpi(mode):
    return resolve_dpi_value(mode, DPI_PRESETS)


def _delete_pdf_pages(
    input_path, output_path, single=None, range_count=None,
    range_start=None, range_end=None, from_back=False,
):
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        total_pages = len(reader.pages)

        pages_to_delete = set()

        if single is not None:
            if from_back:
                idx = total_pages - single
            else:
                idx = single - 1

            if 0 <= idx < total_pages:
                pages_to_delete.add(idx)
            else:
                raise ValueError(
                    f"指定页码 {single} 超出文件总页数范围（当前文件共 {total_pages} 页）"
                )

        elif range_start is not None and range_end is not None:
            if range_start < 1 or range_end > total_pages or range_start > range_end:
                raise ValueError(
                    f"页码范围无效。PDF 共有 {total_pages} 页，请输入有效范围 (1-{total_pages})"
                )
            if range_end - range_start + 1 >= total_pages:
                raise ValueError(
                    f"删除范围 ({range_start}-{range_end}) 覆盖全部 {total_pages} 页，拒绝清空整个文件"
                )
            for i in range(range_start - 1, range_end):
                pages_to_delete.add(i)

        elif range_count is not None:
            if range_count >= total_pages:
                raise ValueError(
                    f"删除页数 {range_count} 大于或等于总页数（{total_pages} 页），拒绝清空整个文件"
                )

            if from_back:
                for i in range(total_pages - range_count, total_pages):
                    pages_to_delete.add(i)
            else:
                for i in range(0, range_count):
                    pages_to_delete.add(i)

        for i in range(total_pages):
            if i not in pages_to_delete:
                writer.add_page(reader.pages[i])

        with open(output_path, "wb") as f:
            writer.write(f)
        return True
    except Exception as e:
        print(f"\n[错误] 文件 {input_path.name} 页面裁剪失败: {e}", flush=True)
        return False


def _extract_pdf_page_to_png(pdf_path, page_number, output_path=None, dpi=300):
    pdf_path = Path(pdf_path).expanduser().resolve()
    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF 文件不存在: {pdf_path}")
    if page_number < 1:
        raise ValueError("页码必须大于 0")

    total_pages = len(PdfReader(pdf_path).pages)
    if page_number > total_pages:
        raise ValueError(f"指定页码 {page_number} 超出范围（当前文件共 {total_pages} 页）")

    output_path = (
        Path(output_path)
        if output_path
        else pdf_path.with_name(f"{pdf_path.stem}_page_{page_number}.png")
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)

    images = convert_from_path(
        pdf_path, dpi=dpi, first_page=page_number, last_page=page_number
    )
    if not images:
        raise ValueError(f"未能提取第 {page_number} 页")

    images[0].save(output_path, "PNG")
    print(f"已保存: {output_path}", flush=True)
    return output_path


def _extract_pdf_pages_range(pdf_path, start_page, end_page, output_path=None):
    pdf_path = Path(pdf_path).expanduser().resolve()
    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF 文件不存在: {pdf_path}")

    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    if start_page < 1 or end_page > total_pages or start_page > end_page:
        raise ValueError(
            f"页码范围无效。PDF 共有 {total_pages} 页，请输入有效范围 (1-{total_pages})"
        )

    output_path = (
        Path(output_path)
        if output_path
        else pdf_path.with_name(f"{pdf_path.stem}_pages_{start_page}-{end_page}.pdf")
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)

    writer = PdfWriter()
    for page_index in range(start_page - 1, end_page):
        writer.add_page(reader.pages[page_index])

    with open(output_path, "wb") as output_file:
        writer.write(output_file)

    print(f"已保存: {output_path} (第 {start_page} 到 {end_page} 页)", flush=True)
    return output_path


def _render_pdf_page(pdf_path, page_number, dpi=150):
    pdf_path = Path(pdf_path).expanduser().resolve()
    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF 文件不存在: {pdf_path}")
    if page_number < 1:
        raise ValueError("页码必须大于 0")

    total_pages = len(PdfReader(pdf_path).pages)
    if page_number > total_pages:
        raise ValueError(f"指定页码 {page_number} 超出范围（当前文件共 {total_pages} 页）")

    images = convert_from_path(
        pdf_path, dpi=dpi, first_page=page_number, last_page=page_number
    )
    if not images:
        raise ValueError(f"未能渲染第 {page_number} 页")
    return images[0]


def _crop_pdf_page_to_png(pdf_path, page_number, crop_box, output_path, dpi=300):
    image = _render_pdf_page(pdf_path, page_number, dpi=dpi)
    width, height = image.size

    try:
        x = float(crop_box["x"])
        y = float(crop_box["y"])
        w = float(crop_box["width"])
        h = float(crop_box["height"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("裁剪区域参数无效") from exc

    if w <= 0 or h <= 0:
        raise ValueError("裁剪区域宽高必须大于 0")
    if x < 0 or y < 0 or x + w > 1 or y + h > 1:
        raise ValueError("裁剪区域超出页面范围")

    left = max(0, min(width - 1, round(x * width)))
    top = max(0, min(height - 1, round(y * height)))
    right = max(left + 1, min(width, round((x + w) * width)))
    bottom = max(top + 1, min(height, round((y + h) * height)))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.crop((left, top, right, bottom)).save(output_path, "PNG")
    print(f"已保存裁剪图片: {output_path}", flush=True)
    return output_path


def _available_output_path(path):
    if not path.exists():
        return path
    for i in range(2, 1000):
        candidate = path.with_name(f"{path.stem}_{i}{path.suffix}")
        if not candidate.exists():
            return candidate
    raise FileExistsError(f"无法生成唯一输出文件名: {path}")


def _batch_delete(all_files, single=None, range_count=None, range_start=None, range_end=None, from_back=False):
    if single is None and range_count is None and (range_start is None or range_end is None):
        raise ValueError("请指定 -s/--single、-r/--range 或 --start/--end")

    if not all_files:
        print("未找到需要处理的 PDF 文件。", flush=True)
        return OperationResult()

    all_files = sorted(all_files)

    print("=" * 48, flush=True)
    if single is not None:
        print(f"  动作: 删除第 {single} 页", flush=True)
    elif range_start is not None and range_end is not None:
        print(f"  动作: 删除第 {range_start} 到 {range_end} 页", flush=True)
    else:
        print(f"  方向: {'【从后往前数】' if from_back else '【从前往后数】'}", flush=True)
        print(f"  动作: 删除连续的 {range_count} 页", flush=True)
    print(f"  PDF 数量: {len(all_files)}", flush=True)
    print("=" * 48, flush=True)
    print("", flush=True)

    result = OperationResult(total=len(all_files))

    for pdf_path in tqdm(all_files, desc="批量剪裁中"):
        current_backup_dir = pdf_path.parent / BACKUP_DIR_PAGE_OPS
        backup_path = current_backup_dir / pdf_path.name

        if backup_path.exists():
            print(f"\n[跳过] 开启保护：{pdf_path.name}", flush=True)
            print(
                f"       -> 原因：专属备份目录 {current_backup_dir.name}/ 中已存在同名原文件",
                flush=True,
            )
            result.skipped += 1
            continue

        try:
            current_backup_dir.mkdir(exist_ok=True)
            pdf_path.rename(backup_path)

            status = _delete_pdf_pages(
                input_path=backup_path,
                output_path=pdf_path,
                single=single,
                range_count=range_count,
                range_start=range_start,
                range_end=range_end,
                from_back=from_back,
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
    print(f"  成功处理 : {result.success}（原名保存）", flush=True)
    print(f"  安全跳过 : {result.skipped}（备份目录已存在原文件）", flush=True)
    print(f"  处理失败 : {result.failed}", flush=True)
    print("=" * 48, flush=True)
    return result


def delete_folder(folder_path, single=None, range_count=None, range_start=None, range_end=None, from_back=False):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"无效的文件夹路径 -> {root}")

    all_files = [p for p in root.rglob("*.pdf") if not any(d in p.parts for d in EXCLUDE_DIRS)]

    print(f"  扫描目录: {root}", flush=True)
    return _batch_delete(all_files, single, range_count, range_start, range_end, from_back)


def delete_file(folder_path, file_arg, single=None, range_count=None, range_start=None, range_end=None, from_back=False):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"无效的文件夹路径 -> {root}")
    pdf_path = resolve_pdf_file(root, file_arg, EXCLUDE_DIRS)
    print(f"  指定文件: {pdf_path.relative_to(root)}", flush=True)
    return _batch_delete([pdf_path], single, range_count, range_start, range_end, from_back)


def extract_png(folder_path, file_arg, page_number, output_arg=None, dpi=300):
    root = Path(folder_path).expanduser().resolve()
    pdf_path = resolve_pdf_file(root, file_arg, EXCLUDE_DIRS)
    output_path = resolve_output_path(
        root, pdf_path, output_arg, f"{pdf_path.stem}_page_{page_number}.png"
    )
    return _extract_pdf_page_to_png(pdf_path, page_number, output_path, dpi=dpi)


def render_page_image(folder_path, file_arg, page_number, dpi=150):
    root = Path(folder_path).expanduser().resolve()
    pdf_path = resolve_pdf_file(root, file_arg, EXCLUDE_DIRS)
    return _render_pdf_page(pdf_path, page_number, dpi=dpi)


def crop_png(folder_path, file_arg, page_number, crop_box, output_arg=None, dpi=300):
    root = Path(folder_path).expanduser().resolve()
    pdf_path = resolve_pdf_file(root, file_arg, EXCLUDE_DIRS)
    output_path = resolve_output_path(
        root, pdf_path, output_arg, f"{pdf_path.stem}_page_{page_number}_crop.png"
    )
    if not output_arg:
        output_path = _available_output_path(output_path)
    return _crop_pdf_page_to_png(pdf_path, page_number, crop_box, output_path, dpi=dpi)


def extract_pdf(folder_path, file_arg, start_page, end_page, output_arg=None):
    root = Path(folder_path).expanduser().resolve()
    pdf_path = resolve_pdf_file(root, file_arg, EXCLUDE_DIRS)
    output_path = resolve_output_path(
        root, pdf_path, output_arg, f"{pdf_path.stem}_pages_{start_page}-{end_page}.pdf"
    )
    return _extract_pdf_pages_range(pdf_path, start_page, end_page, output_path)


def get_pdf_metadata(folder_path, file_arg):
    root = Path(folder_path).expanduser().resolve()
    pdf_path = resolve_pdf_file(root, file_arg, EXCLUDE_DIRS)
    reader = PdfReader(pdf_path)
    metadata = reader.metadata or {}
    result = {}
    for field, pdf_key in PDF_METADATA_FIELDS.items():
        value = metadata.get(pdf_key, "")
        result[field] = str(value) if value is not None else ""
    result["pages"] = len(reader.pages)
    result["name"] = pdf_path.name
    result["path"] = str(pdf_path)
    return result


def update_pdf_metadata(folder_path, file_arg, metadata):
    root = Path(folder_path).expanduser().resolve()
    pdf_path = resolve_pdf_file(root, file_arg, EXCLUDE_DIRS)
    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)

    next_metadata = {
        str(key): str(value)
        for key, value in dict(reader.metadata or {}).items()
        if value is not None
    }
    for field, pdf_key in PDF_METADATA_FIELDS.items():
        value = str((metadata or {}).get(field, "")).strip()
        if value:
            next_metadata[pdf_key] = value
        else:
            next_metadata.pop(pdf_key, None)
    writer.add_metadata(next_metadata)

    tmp_path = pdf_path.with_name(f".{pdf_path.name}.metadata.tmp")
    try:
        with open(tmp_path, "wb") as f:
            writer.write(f)
        tmp_path.replace(pdf_path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()

    print(f"已更新 PDF 元数据: {pdf_path.name}", flush=True)
    return OperationResult(total=1, success=1, outputs=[pdf_path])


def clean_page_backups(folder_path):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"无效的文件夹路径 -> {root}")
    dirs = sorted(root.rglob(BACKUP_DIR_PAGE_OPS))
    if not dirs:
        print("未找到任何 y_backup 备份目录。", flush=True)
        return OperationResult()
    for d in dirs:
        shutil.rmtree(d)
        print(f"已删除备份目录: {d}", flush=True)
    print(f"\n共清理 {len(dirs)} 个 y_backup 备份目录。", flush=True)
    return OperationResult(total=len(dirs), success=len(dirs))
