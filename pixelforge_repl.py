#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PixelForge — 交互式命令行 (REPL)

启动方式: python pixelforge_repl.py [--cwd /path/to/start]

特性:
  - Tab 自动补全命令和文件路径
  - 命令历史记录（持久化到 ~/.pixelforge_history）
  - 内置 cd / ls / pwd 导航
  - 默认在当前目录操作
"""

import shlex
import sys
from pathlib import Path

from prompt_toolkit import PromptSession
from prompt_toolkit.completion import Completer, Completion
from prompt_toolkit.history import FileHistory
from prompt_toolkit.formatted_text import HTML

from pixelforge_core import (
    DPI_PRESETS,
    EXCLUDE_DIRS,
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

HISTORY_FILE = Path.home() / ".pixelforge_history"

COMMANDS = {
    "help": "显示帮助信息",
    "cd": "切换工作目录  cd <path>",
    "ls": "列出当前目录下的 PDF/ZIP 文件  ls [path]",
    "pwd": "显示当前工作目录",
    "resize": "页面缩放  resize [-s] [-w W] [-H H] [--file F]",
    "delete": "页面删除  delete -s N | -r N [-b] | --start S --end E [--file F]",
    "extract-png": "提取单页为 PNG  extract-png --file F --page N [--dpi-mode M]",
    "extract-pdf": "提取页码范围为 PDF  extract-pdf --file F --start N --end M",
    "zip2pdf": "ZIP 转 PDF  zip2pdf [--file F] [--dpi-mode M]",
    "clean": "清理  clean backup_resize|backup_page_ops|zip|output_images|all",
    "open": "在 Finder 中打开当前目录",
    "exit": "退出",
    "quit": "退出",
}


class PixelForgeCompleter(Completer):
    def __init__(self, get_cwd):
        self.get_cwd = get_cwd

    def get_completions(self, document, complete_event):
        text = document.text_before_cursor
        tokens = text.split()

        if not tokens or (len(tokens) == 1 and not text.endswith(" ")):
            word = tokens[0] if tokens else ""
            for cmd in COMMANDS:
                if cmd.startswith(word):
                    yield Completion(cmd, start_position=-len(word), display_meta=COMMANDS[cmd])
            return

        if text.endswith(" "):
            tokens.append("")

        cmd = tokens[0]
        current = tokens[-1] if tokens else ""

        if cmd in ("cd", "resize", "delete", "extract-png", "extract-pdf", "zip2pdf", "clean", "ls"):
            cwd = self.get_cwd()

            if current.startswith("-"):
                flags = {
                    "resize": ["--strip", "-w", "-H", "--file", "--open", "--clean"],
                    "delete": ["-s", "-r", "--start", "--end", "-b", "--file", "--open", "--clean"],
                    "extract-png": ["--file", "--page", "--dpi-mode", "--open"],
                    "extract-pdf": ["--file", "--start", "--end", "--open"],
                    "zip2pdf": ["--file", "--dpi-mode", "--open", "--clean"],
                    "clean": [],
                }
                for flag in flags.get(cmd, []):
                    if flag.startswith(current):
                        yield Completion(flag, start_position=-len(current))
                return

            # Complete file/dir paths
            search_dir = cwd
            prefix = current
            if "/" in current:
                parts = current.rsplit("/", 1)
                search_dir = cwd / parts[0]
                prefix = parts[1]

            if not search_dir.is_dir():
                return

            try:
                for item in sorted(search_dir.iterdir()):
                    name = item.name
                    if name.startswith("."):
                        continue
                    if not name.startswith(prefix):
                        continue

                    if item.is_dir():
                        display = name + "/"
                        yield Completion(
                            (current.rsplit("/", 1)[0] + "/" if "/" in current else "") + name + "/",
                            start_position=-len(current),
                            display=display,
                            display_meta="dir",
                        )
                    elif cmd == "cd":
                        continue
                    else:
                        ext = item.suffix.lower()
                        if cmd in ("resize", "delete", "extract-png", "extract-pdf") and ext != ".pdf":
                            if current:
                                continue
                        elif cmd == "zip2pdf" and ext != ".zip":
                            if current:
                                continue
                        yield Completion(
                            (current.rsplit("/", 1)[0] + "/" if "/" in current else "") + name,
                            start_position=-len(current),
                            display=name,
                            display_meta=ext,
                        )
            except PermissionError:
                pass

        if cmd == "clean" and len(tokens) == 2:
            for t in ["backup_resize", "backup_page_ops", "zip", "output_images", "all"]:
                if t.startswith(current):
                    yield Completion(t, start_position=-len(current))

        if "--dpi-mode" in tokens:
            idx = tokens.index("--dpi-mode")
            if idx == len(tokens) - 2 or (idx == len(tokens) - 1 and current):
                for m in sorted(DPI_PRESETS):
                    if m.startswith(current):
                        yield Completion(m, start_position=-len(current))


class PixelForgeREPL:
    def __init__(self, cwd=None):
        self.cwd = Path(cwd or Path.cwd()).expanduser().resolve()
        self.session = PromptSession(
            history=FileHistory(str(HISTORY_FILE)),
            completer=PixelForgeCompleter(lambda: self.cwd),
        )

    def prompt_text(self):
        return HTML(f"<b>pixelforge</b> <ansiblue>{self.cwd}</ansiblue> > ")

    def run(self):
        print("PixelForge — 交互式命令行")
        print("输入 help 查看可用命令，Tab 自动补全\n")

        while True:
            try:
                text = self.session.prompt(self.prompt_text())
            except (EOFError, KeyboardInterrupt):
                print("\n再见！")
                break

            text = text.strip()
            if not text:
                continue

            try:
                tokens = shlex.split(text)
            except ValueError as e:
                print(f"[语法错误] {e}")
                continue

            cmd = tokens[0]
            args = tokens[1:]

            try:
                self.dispatch(cmd, args)
            except Exception as e:
                print(f"[错误] {e}")

    def dispatch(self, cmd, args):
        handlers = {
            "help": self.cmd_help,
            "cd": self.cmd_cd,
            "ls": self.cmd_ls,
            "pwd": self.cmd_pwd,
            "resize": self.cmd_resize,
            "delete": self.cmd_delete,
            "extract-png": self.cmd_extract_png,
            "extract-pdf": self.cmd_extract_pdf,
            "zip2pdf": self.cmd_zip2pdf,
            "clean": self.cmd_clean,
            "open": self.cmd_open,
            "exit": self.cmd_exit,
            "quit": self.cmd_exit,
        }
        handler = handlers.get(cmd)
        if handler:
            handler(args)
        else:
            print(f"未知命令: {cmd}")
            print("输入 help 查看可用命令")

    # --- Navigation ---

    def cmd_help(self, args):
        print("\n可用命令:")
        print("-" * 60)
        for cmd, desc in COMMANDS.items():
            print(f"  {cmd:15s} {desc}")
        print()

    def cmd_cd(self, args):
        if not args:
            self.cwd = Path.home()
        else:
            target = Path(args[0]).expanduser()
            if not target.is_absolute():
                target = self.cwd / target
            target = target.resolve()
            if not target.is_dir():
                print(f"目录不存在: {target}")
                return
            self.cwd = target
        print(f"当前目录: {self.cwd}")

    def cmd_ls(self, args):
        target = self.cwd
        if args:
            p = Path(args[0]).expanduser()
            if not p.is_absolute():
                p = self.cwd / p
            target = p.resolve()

        if not target.is_dir():
            print(f"不是目录: {target}")
            return

        pdfs = [f for f in sorted(target.rglob("*.pdf")) if not any(d in f.parts for d in EXCLUDE_DIRS)]
        zips = sorted(target.glob("*.zip"))

        print(f"\n目录: {target}\n")
        if pdfs:
            print(f"  PDF 文件 ({len(pdfs)}):")
            for f in pdfs:
                print(f"    {f.relative_to(target)}")
        if zips:
            print(f"  ZIP 文件 ({len(zips)}):")
            for f in zips:
                print(f"    {f.name}")
        if not pdfs and not zips:
            print("  未找到 PDF 或 ZIP 文件")
        print()

    def cmd_pwd(self, args):
        print(str(self.cwd))

    def cmd_open(self, args):
        open_folder(str(self.cwd))

    def cmd_exit(self, args):
        raise EOFError()

    # --- PDF Operations ---

    def _parse_flags(self, args, flags_with_value=None, flags_bool=None):
        """Simple flag parser returning (parsed_dict, positional_list)."""
        flags_with_value = flags_with_value or []
        flags_bool = flags_bool or []
        parsed = {}
        positional = []
        i = 0
        while i < len(args):
            a = args[i]
            if a in flags_bool:
                parsed[a] = True
            elif a in flags_with_value and i + 1 < len(args):
                i += 1
                parsed[a] = args[i]
            else:
                positional.append(a)
            i += 1
        return parsed, positional

    def cmd_resize(self, args):
        opts, pos = self._parse_flags(
            args,
            flags_with_value=["-w", "-H", "--file"],
            flags_bool=["-s", "--strip", "--clean", "--open"],
        )
        width = float(opts.get("-w", 210))
        height = float(opts.get("-H", 297))
        strip = "-s" in opts or "--strip" in opts
        file_arg = opts.get("--file")
        folder = str(self.cwd)

        if "--clean" in opts:
            clean_resize_backups(folder)
        elif file_arg:
            resize_file(folder, file_arg, width, height, strip)
        else:
            resize_folder(folder, width, height, strip)

        if "--open" in opts:
            open_folder(folder)

    def cmd_delete(self, args):
        opts, pos = self._parse_flags(
            args,
            flags_with_value=["-s", "-r", "--file", "--start", "--end"],
            flags_bool=["-b", "--back", "--clean", "--open"],
        )
        single = int(opts["-s"]) if "-s" in opts else None
        range_count = int(opts["-r"]) if "-r" in opts else None
        range_start = int(opts["--start"]) if "--start" in opts else None
        range_end = int(opts["--end"]) if "--end" in opts else None
        from_back = "-b" in opts or "--back" in opts
        file_arg = opts.get("--file")
        folder = str(self.cwd)

        if "--clean" in opts:
            clean_page_backups(folder)
        elif single is None and range_count is None and (range_start is None or range_end is None):
            print("请指定 -s <页码>、-r <页数> 或 --start <起始页> --end <结束页>")
        elif file_arg:
            delete_file(folder, file_arg, single, range_count, range_start, range_end, from_back)
        else:
            delete_folder(folder, single, range_count, range_start, range_end, from_back)

        if "--open" in opts:
            open_folder(folder)

    def cmd_extract_png(self, args):
        opts, pos = self._parse_flags(
            args,
            flags_with_value=["--file", "--page", "--dpi-mode", "-o"],
            flags_bool=["--open"],
        )
        file_arg = opts.get("--file")
        page = opts.get("--page")
        dpi_mode = opts.get("--dpi-mode", "bw")
        output = opts.get("-o")

        if not file_arg or not page:
            print("请指定 --file <PDF> --page <页码>")
            return

        dpi = resolve_dpi(dpi_mode)
        extract_png(str(self.cwd), file_arg, int(page), output, dpi=dpi)

        if "--open" in opts:
            open_folder(str(self.cwd))

    def cmd_extract_pdf(self, args):
        opts, pos = self._parse_flags(
            args,
            flags_with_value=["--file", "--start", "--end", "-o"],
            flags_bool=["--open"],
        )
        file_arg = opts.get("--file")
        start = opts.get("--start")
        end = opts.get("--end")
        output = opts.get("-o")

        if not file_arg or not start or not end:
            print("请指定 --file <PDF> --start <起始页> --end <结束页>")
            return

        extract_pdf(str(self.cwd), file_arg, int(start), int(end), output)

        if "--open" in opts:
            open_folder(str(self.cwd))

    def cmd_zip2pdf(self, args):
        opts, pos = self._parse_flags(
            args,
            flags_with_value=["--file", "--dpi-mode"],
            flags_bool=["--clean", "--open"],
        )
        file_arg = opts.get("--file")
        dpi_mode = opts.get("--dpi-mode", "bw")
        dpi = resolve_dpi(dpi_mode)
        folder = str(self.cwd)

        if "--clean" in opts:
            clean_zip_files(folder)
        elif file_arg:
            zip_file(folder, file_arg, dpi=dpi)
        else:
            zip_folder(folder, dpi=dpi)

        if "--open" in opts:
            open_folder(folder)

    def cmd_clean(self, args):
        if not args:
            print("请指定清理类型: backup_resize, backup_page_ops, zip, output_images, all")
            return

        clean_type = args[0]
        folder = str(self.cwd)

        if clean_type == "backup_resize":
            clean_resize_backups(folder)
        elif clean_type == "backup_page_ops":
            clean_page_backups(folder)
        elif clean_type == "zip":
            clean_zip_files(folder)
        elif clean_type == "output_images":
            clean_image_outputs(folder)
        elif clean_type == "all":
            clean_resize_backups(folder)
            clean_page_backups(folder)
            clean_zip_files(folder)
            clean_image_outputs(folder)
        else:
            print(f"未知清理类型: {clean_type}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="PixelForge — 交互式命令行")
    parser.add_argument("--cwd", default=None, help="初始工作目录")
    args = parser.parse_args()

    repl = PixelForgeREPL(cwd=args.cwd)
    repl.run()


if __name__ == "__main__":
    main()
