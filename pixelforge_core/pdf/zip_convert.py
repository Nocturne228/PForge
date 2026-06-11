import re
import subprocess
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from tqdm import tqdm

from pixelforge_core.config import DPI_PRESETS, IMAGE_EXTENSIONS
from pixelforge_core.utils import (
    OperationResult,
    log,
    natural_key,
    resolve_dpi as resolve_dpi_value,
)


def resolve_dpi(mode):
    return resolve_dpi_value(mode, DPI_PRESETS)


def _should_report_progress(done, total, last_percent):
    if total <= 0:
        return False, last_percent
    percent = int(done * 100 / total)
    if percent > last_percent and (percent == 100 or percent >= last_percent + 10):
        return True, percent
    return False, last_percent


def _safe_extract(zip_path: Path, out_dir: Path):
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.infolist():
            try:
                if member.is_dir():
                    continue
                name = member.filename
                target = (out_dir / name).resolve()
                try:
                    target.relative_to(out_dir.resolve())
                except ValueError:
                    log.info(f"  [跳过] ZIP 内路径越界: {name}")
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)

                with zf.open(member) as src, open(target, "wb") as dst:
                    dst.write(src.read())
            except Exception as exc:
                log.info(f"  [跳过] 解压失败: {member.filename} ({exc})")


def _find_images(folder: Path):
    images = []
    for f in folder.rglob("*"):
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS:
            images.append(f)
    return sorted(images, key=natural_key)


def _diagnose_image(path: Path):
    info = {
        "file": path.name,
        "size": path.stat().st_size if path.exists() else -1,
        "reason": None,
    }

    if not path.exists():
        info["reason"] = "文件不存在"
        return False, info

    if info["size"] == 0:
        info["reason"] = "空文件"
        return False, info

    try:
        r = subprocess.run(
            ["magick", "identify", str(path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

        if r.returncode != 0:
            err = (r.stderr or "").lower()

            if "no decode delegate" in err:
                info["reason"] = "不支持的格式或缺少解码器"
            elif "corrupt" in err:
                info["reason"] = "图片文件损坏"
            elif "unable to open" in err:
                info["reason"] = "文件不存在或路径错误"
            else:
                info["reason"] = "ImageMagick 处理错误"

            return False, info

    except FileNotFoundError:
        info["reason"] = "未找到 ImageMagick，请先安装 magick 命令（macOS: brew install imagemagick；Ubuntu/Debian: sudo apt install imagemagick）"
        return False, info
    except Exception as e:
        info["reason"] = f"异常: {type(e).__name__}"
        return False, info

    return True, info


def _images_to_pdf(images, output_pdf: Path, dpi=600):
    if not images:
        return False

    cmd = [
        "magick",
        "-monitor",
        "-density",
        str(dpi),
        *[str(p) for p in images],
        "-auto-orient",
        "-units",
        "PixelsPerInch",
        "-density",
        str(dpi),
        "-colorspace",
        "sRGB",
        "-strip",
        "-quality",
        "92",
        str(output_pdf),
    ]

    log.info(f"  正在生成 PDF: {output_pdf.name}")
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )

        chunk = ""
        last_percent = -10
        tail = []

        while True:
            char = proc.stdout.read(1) if proc.stdout else ""
            if char == "" and proc.poll() is not None:
                break
            if not char:
                continue
            if char in "\r\n":
                line = chunk.strip()
                chunk = ""
                if not line:
                    continue
                tail.append(line)
                tail = tail[-5:]

                match = re.search(r"(\d{1,3})%", line)
                if match:
                    percent = min(int(match.group(1)), 100)
                    if percent > last_percent and (percent == 100 or percent >= last_percent + 10):
                        log.progress(f"  生成进度: {percent}%")
                        last_percent = percent
                elif "error" in line.lower() or "unable" in line.lower():
                    log.info(f"  [ImageMagick] {line}")
            else:
                chunk += char

        if chunk.strip():
            tail.append(chunk.strip())

        returncode = proc.wait()
        if returncode != 0:
            if last_percent >= 0:
                log.blank()
            log.error(f"ImageMagick 转换失败，退出码: {returncode}")
            for line in tail[-3:]:
                log.info(f"  [ImageMagick] {line}")
            return False

        if last_percent >= 0:
            log.blank()
        log.done(f"  PDF 生成完成: {output_pdf.name}")
        return True
    except FileNotFoundError:
        log.error("未找到 ImageMagick，请先安装 magick 命令（macOS: brew install imagemagick；Ubuntu/Debian: sudo apt install imagemagick）")
        return False
    except Exception as e:
        log.error(f"ImageMagick 转换失败: {e}")
        return False


def _process_single_zip(zip_path: Path, dpi=600):
    log.blank()
    log.section([f"处理: {zip_path.stem}", f"输出 DPI: {dpi}"])

    output_pdf = zip_path.with_suffix(".pdf")

    work_dir = zip_path.parent / ".work"
    work_dir.mkdir(exist_ok=True)
    with TemporaryDirectory(dir=work_dir) as tmp:
        tmp = Path(tmp)
        _safe_extract(zip_path, tmp)

        images = _find_images(tmp)
        log.info(f"  图片总数: {len(images)}")

        valid_images = []
        log.info("  正在检查图片...")

        last_percent = 0
        for index, img in enumerate(images, start=1):
            ok, info = _diagnose_image(img)
            if ok:
                valid_images.append(img)
            else:
                log.info(f"  [跳过] 无效图片: {info['file']}")
                log.info(f"    ├─ 原因: {info['reason']}")
                log.info(f"    └─ 大小: {info['size']} 字节")
            should_report, last_percent = _should_report_progress(index, len(images), last_percent)
            if should_report:
                log.progress(f"  图片检查进度: {index}/{len(images)} ({last_percent}%)")

        if not valid_images:
            if last_percent > 0:
                log.blank()
            log.error("未找到有效图片，跳过。")
            return False

        if last_percent > 0:
            log.blank()
        log.info(f"  有效图片: {len(valid_images)}")
        return _images_to_pdf(valid_images, output_pdf, dpi=dpi)


def _batch_zip(zip_files, dpi=600):
    if not zip_files:
        log.info("  未找到任何 ZIP 文件。")
        return OperationResult()

    zip_files = sorted(zip_files)

    log.info(f"  ZIP 文件数: {len(zip_files)}")
    log.info(f"  输出 DPI: {dpi}")

    result = OperationResult(total=len(zip_files))
    for index, z in enumerate(tqdm(zip_files, desc="ZIP 转 PDF 中"), start=1):
        log.info(f"  ZIP 进度: {index}/{len(zip_files)}")
        if _process_single_zip(z, dpi=dpi):
            result.success += 1
            result.outputs.append(z.with_suffix(".pdf"))
        else:
            result.failed += 1

    log.report(result)
    return result


def zip_folder(folder_path, dpi=600):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"无效的文件夹路径 -> {root}")

    zip_files = sorted(root.glob("*.zip"))
    log.info(f"  扫描目录: {root}")
    return _batch_zip(zip_files, dpi=dpi)


def zip_file(folder_path, file_arg, dpi=600):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"无效的文件夹路径 -> {root}")

    if not file_arg:
        raise ValueError("需要指定 --file")
    candidate = Path(file_arg).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate
    candidate = candidate.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError("ZIP 文件必须位于目标文件夹内") from exc
    if not candidate.is_file() or candidate.suffix.lower() != ".zip":
        raise FileNotFoundError(f"ZIP 文件不存在: {candidate}")

    log.info(f"  指定文件: {candidate.relative_to(root)}")
    return _batch_zip([candidate], dpi=dpi)


def clean_zip_files(folder_path):
    root = Path(folder_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"无效的文件夹路径 -> {root}")
    zips = sorted(root.glob("*.zip"))
    if not zips:
        log.info("未找到任何 ZIP 文件。")
        return OperationResult()
    for z in zips:
        z.unlink()
        log.done(f"已删除: {z.name}")
    log.info(f"\n共清理 {len(zips)} 个 ZIP 文件。")
    return OperationResult(total=len(zips), success=len(zips))
