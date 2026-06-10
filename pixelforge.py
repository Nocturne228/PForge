#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PixelForge — 统一 CLI 入口

子命令:
  resize       PDF 页面尺寸批量统一
  delete       PDF 页面批量删除
  extract-png  提取单页为 PNG
  extract-pdf  提取页码范围为 PDF
  zip2pdf      ZIP 压缩包批量转 PDF
  clean        清理备份目录或 ZIP 文件
"""

import argparse
import sys

from pixelforge_core import (
    DPI_PRESETS,
    clean_image_outputs,
    clean_page_backups,
    clean_resize_backups,
    clean_zip_files,
    delete_file,
    delete_folder,
    extract_pdf,
    extract_png,
    open_folder,
    resize_file,
    resize_folder,
    resolve_dpi,
    zip_file,
    zip_folder,
)


def _exit_if_failed(result):
    if getattr(result, "failed", 0):
        sys.exit(1)


def _open_if_requested(args):
    if not args.open:
        return
    try:
        open_folder(args.folder)
    except Exception as exc:
        print(f"[错误] {exc}", flush=True)
        sys.exit(1)


def cmd_resize(args):
    try:
        if args.clean:
            result = clean_resize_backups(args.folder)
        else:
            if args.file:
                result = resize_file(args.folder, args.file, args.width, args.height, args.strip)
            else:
                result = resize_folder(args.folder, args.width, args.height, args.strip)
        _exit_if_failed(result)
    except Exception as exc:
        print(f"[错误] {exc}", flush=True)
        sys.exit(1)
    _open_if_requested(args)


def cmd_delete(args):
    try:
        if args.clean:
            result = clean_page_backups(args.folder)
        else:
            if args.single is None and args.range is None and (args.start is None or args.end is None):
                print("[错误] 请指定 -s/--single、-r/--range 或 --start/--end", flush=True)
                sys.exit(1)
            range_start = args.start
            range_end = args.end
            if args.file:
                result = delete_file(
                    args.folder, args.file, args.single, args.range,
                    range_start, range_end, args.back,
                )
            else:
                result = delete_folder(
                    args.folder, args.single, args.range,
                    range_start, range_end, args.back,
                )
        _exit_if_failed(result)
    except Exception as exc:
        print(f"[错误] {exc}", flush=True)
        sys.exit(1)
    _open_if_requested(args)


def cmd_extract_png(args):
    if not args.file:
        print("[错误] 提取操作需要指定 --file", flush=True)
        sys.exit(1)
    try:
        dpi = resolve_dpi(args.dpi_mode)
        extract_png(args.folder, args.file, args.page, args.output, dpi=dpi)
    except Exception as exc:
        print(f"[错误] {exc}", flush=True)
        sys.exit(1)
    _open_if_requested(args)


def cmd_extract_pdf(args):
    if not args.file:
        print("[错误] 提取操作需要指定 --file", flush=True)
        sys.exit(1)
    try:
        extract_pdf(args.folder, args.file, args.start, args.end, args.output)
    except Exception as exc:
        print(f"[错误] {exc}", flush=True)
        sys.exit(1)
    _open_if_requested(args)


def cmd_zip2pdf(args):
    try:
        if args.clean:
            result = clean_zip_files(args.folder)
        else:
            dpi = resolve_dpi(args.dpi_mode)
            if args.file:
                result = zip_file(args.folder, args.file, dpi=dpi)
            else:
                result = zip_folder(args.folder, dpi=dpi)
        _exit_if_failed(result)
    except Exception as exc:
        print(f"[错误] {exc}", flush=True)
        sys.exit(1)
    _open_if_requested(args)


def cmd_clean(args):
    try:
        if args.type == "backup_resize":
            clean_resize_backups(args.folder)
        elif args.type == "backup_page_ops":
            clean_page_backups(args.folder)
        elif args.type == "zip":
            clean_zip_files(args.folder)
        elif args.type == "output_images":
            clean_image_outputs(args.folder)
        elif args.type == "all":
            clean_resize_backups(args.folder)
            clean_page_backups(args.folder)
            clean_zip_files(args.folder)
            clean_image_outputs(args.folder)
    except Exception as exc:
        print(f"[错误] {exc}", flush=True)
        sys.exit(1)
    _open_if_requested(args)


def build_parser():
    parser = argparse.ArgumentParser(
        prog="PixelForge",
        description="PixelForge — 统一命令行工具",
    )
    sub = parser.add_subparsers(dest="command", help="可用子命令")

    # --- resize ---
    p_resize = sub.add_parser("resize", help="PDF 页面尺寸批量统一")
    p_resize.add_argument("folder", help="PDF 文件夹路径")
    p_resize.add_argument("-s", "--strip", action="store_true", help="条形漫画模式")
    p_resize.add_argument("-w", "--width", type=float, default=210.0, help="目标宽度 mm")
    p_resize.add_argument("-H", "--height", type=float, default=297.0, help="目标高度 mm")
    p_resize.add_argument("--file", help="只处理指定 PDF 文件")
    p_resize.add_argument("--open", action="store_true", help="完成后打开目录")
    p_resize.add_argument("--clean", action="store_true", help="清理 backup_resize")
    p_resize.set_defaults(func=cmd_resize)

    # --- delete ---
    p_delete = sub.add_parser("delete", help="PDF 页面批量删除")
    p_delete.add_argument("folder", help="PDF 文件夹路径")
    p_delete.add_argument("-s", "--single", type=int, help="删除指定页码")
    p_delete.add_argument("-r", "--range", type=int, help="删除前 N 或后 N 页")
    p_delete.add_argument("--start", type=int, help="删除起止页码（起始页，需配合 --end）")
    p_delete.add_argument("--end", type=int, help="删除起止页码（结束页，需配合 --start）")
    p_delete.add_argument("-b", "--back", action="store_true", help="从后往前数（仅配合 -r 使用）")
    p_delete.add_argument("--file", help="只处理指定 PDF 文件")
    p_delete.add_argument("--open", action="store_true", help="完成后打开目录")
    p_delete.add_argument("--clean", action="store_true", help="清理 backup_page_ops")
    p_delete.set_defaults(func=cmd_delete)

    # --- extract-png ---
    p_epng = sub.add_parser("extract-png", help="提取单页为 PNG")
    p_epng.add_argument("folder", help="PDF 文件夹路径")
    p_epng.add_argument("--file", required=True, help="指定 PDF 文件")
    p_epng.add_argument("--page", type=int, required=True, help="页码")
    p_epng.add_argument("-o", "--output", help="输出路径")
    p_epng.add_argument("--dpi-mode", choices=sorted(DPI_PRESETS), default="bw")
    p_epng.add_argument("--open", action="store_true", help="完成后打开目录")
    p_epng.set_defaults(func=cmd_extract_png)

    # --- extract-pdf ---
    p_epdf = sub.add_parser("extract-pdf", help="提取页码范围为 PDF")
    p_epdf.add_argument("folder", help="PDF 文件夹路径")
    p_epdf.add_argument("--file", required=True, help="指定 PDF 文件")
    p_epdf.add_argument("--start", type=int, required=True, help="起始页码")
    p_epdf.add_argument("--end", type=int, required=True, help="结束页码")
    p_epdf.add_argument("-o", "--output", help="输出路径")
    p_epdf.add_argument("--open", action="store_true", help="完成后打开目录")
    p_epdf.set_defaults(func=cmd_extract_pdf)

    # --- zip2pdf ---
    p_zip = sub.add_parser("zip2pdf", help="ZIP 压缩包批量转 PDF")
    p_zip.add_argument("folder", help="ZIP 文件夹路径")
    p_zip.add_argument("--file", help="只处理指定 ZIP 文件")
    p_zip.add_argument("--dpi-mode", choices=sorted(DPI_PRESETS), default="bw")
    p_zip.add_argument("--open", action="store_true", help="完成后打开目录")
    p_zip.add_argument("--clean", action="store_true", help="清理 ZIP 文件")
    p_zip.set_defaults(func=cmd_zip2pdf)

    # --- clean ---
    p_clean = sub.add_parser("clean", help="清理备份目录、输出目录或 ZIP 文件")
    p_clean.add_argument("folder", help="目标文件夹路径")
    p_clean.add_argument(
        "type",
        choices=["backup_resize", "backup_page_ops", "zip", "output_images", "all"],
        help="清理类型",
    )
    p_clean.add_argument("--open", action="store_true", help="完成后打开目录")
    p_clean.set_defaults(func=cmd_clean)

    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.command:
        parser.print_help()
        sys.exit(0)
    args.func(args)


if __name__ == "__main__":
    main()
