import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

from tqdm import tqdm


@dataclass
class OperationResult:
    total: int = 0
    success: int = 0
    skipped: int = 0
    failed: int = 0
    corrupted: list = field(default_factory=list)
    outputs: list[Path] = field(default_factory=list)

    @property
    def ok(self):
        return self.failed == 0


class ProgressLogger:
    """Structured progress output for core operations."""

    def info(self, msg):
        print(msg, flush=True)

    def progress(self, msg):
        print(msg, end="\r", flush=True)

    def error(self, msg):
        print(f"[错误] {msg}", flush=True)

    def skip(self, name, reason):
        print(f"\n[跳过] 开启保护：{name}", flush=True)
        print(f"       -> 原因：{reason}", flush=True)

    def section(self, lines):
        print("=" * 48, flush=True)
        for line in lines:
            print(f"  {line}", flush=True)
        print("=" * 48, flush=True)
        print("", flush=True)

    def report(self, result):
        print("", flush=True)
        self.section([
            "任务执行完毕报告",
            f"文件总数 : {result.total}",
            f"成功处理 : {result.success}",
            f"安全跳过 : {result.skipped}",
            f"处理失败 : {result.failed}",
        ])

    def done(self, msg):
        print(msg, flush=True)

    def blank(self):
        print("", flush=True)


log = ProgressLogger()


def open_folder(folder_path):
    path = Path(folder_path).expanduser().resolve()
    if not path.is_dir():
        raise FileNotFoundError(f"目录不存在: {path}")
    if sys.platform == "darwin":
        subprocess.run(["open", str(path)], check=True)
    elif sys.platform == "win32":
        subprocess.run(["explorer", str(path)], check=True)
    else:
        subprocess.run(["xdg-open", str(path)], check=True)
    log.done(f"已打开: {path}")


def resolve_pdf_file(root, file_arg, exclude_dirs):
    if not file_arg:
        raise ValueError("需要指定 --file")
    root = Path(root).expanduser().resolve()
    candidate = Path(file_arg).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate
    candidate = candidate.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError("PDF 文件必须位于目标文件夹内") from exc
    if not candidate.is_file() or candidate.suffix.lower() != ".pdf":
        raise FileNotFoundError(f"PDF 文件不存在: {candidate}")
    if any(d in candidate.parts for d in exclude_dirs):
        raise ValueError("不能处理备份目录中的 PDF 文件")
    return candidate


def resolve_output_path(root, pdf_path, output_arg, default_name):
    if not output_arg:
        return pdf_path.with_name(default_name)
    root = Path(root).expanduser().resolve()
    output = Path(output_arg).expanduser()
    if not output.is_absolute():
        output = pdf_path.parent / output
    output = output.resolve()
    try:
        output.relative_to(root)
    except ValueError as exc:
        raise ValueError("输出路径必须位于目标文件夹内") from exc
    return output


def resolve_dpi(mode, presets):
    if mode not in presets:
        raise ValueError(f"未知 DPI 模式: {mode}")
    return presets[mode]


def available_output_path(path):
    """Return a non-existing file path by appending a numeric suffix if needed."""
    path = Path(path)
    if not path.exists():
        return path
    for i in range(2, 1000):
        candidate = path.with_name(f"{path.stem}_{i}{path.suffix}")
        if not candidate.exists():
            return candidate
    raise FileExistsError(f"无法生成唯一输出文件名: {path}")


def natural_key(path):
    """Sort key that orders numeric segments naturally (page1 < page2 < page10)."""
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r"(\d+)", Path(path).name)]


def clean_dirs_by_name(root, dir_name):
    """Recursively delete all subdirectories named dir_name under root.

    Returns OperationResult with count of deleted directories.
    """
    root = Path(root).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"路径不存在或不是一个有效的文件夹 -> {root}")
    dirs = sorted(root.rglob(dir_name))
    if not dirs:
        log.info(f"未找到任何 {dir_name} 目录。")
        return OperationResult()
    for d in dirs:
        shutil.rmtree(d)
        log.done(f"已删除: {d}")
    log.info(f"\n共清理 {len(dirs)} 个 {dir_name} 目录。")
    return OperationResult(total=len(dirs), success=len(dirs))


def batch_with_backup(files, backup_dir_name, process_fn, *, header_fn=None, desc="处理中"):
    """Generic backup-then-process batch framework.

    For each file: checks if backup already exists (skip), renames original to
    backup dir, calls process_fn(backup_path, original_path).  On failure the
    backup is renamed back to restore the original.
    """
    if not files:
        log.info("未找到需要处理的文件。")
        return OperationResult()

    files = sorted(files)

    if header_fn:
        header_fn(files)

    result = OperationResult(total=len(files))

    for file_path in tqdm(files, desc=desc):
        backup_dir = file_path.parent / backup_dir_name
        backup_path = backup_dir / file_path.name

        if backup_path.exists():
            log.skip(file_path.name, f"备份目录 {backup_dir.name}/ 中已存在同名原文件")
            result.skipped += 1
            continue

        try:
            backup_dir.mkdir(exist_ok=True)
            file_path.rename(backup_path)

            if process_fn(backup_path, file_path):
                result.success += 1
                result.outputs.append(file_path)
            else:
                result.failed += 1
                if backup_path.exists():
                    backup_path.rename(file_path)

        except Exception as e:
            result.failed += 1
            log.info(f"\n[系统异常] 无法安全备份或处理 {file_path.name}: {e}")
            if backup_path.exists() and not file_path.exists():
                backup_path.rename(file_path)

    log.report(result)
    return result
