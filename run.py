#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PDF 处理平台 — Web 服务启动入口

启动方式: python run.py [--home /path/to/dir] [--port 5000] [--host 127.0.0.1] [--debug]
"""

import argparse
import os

from pdfkit_app import create_app


def main():
    parser = argparse.ArgumentParser(description="PDF 处理平台 Web 服务")
    parser.add_argument("--home", help="设置默认目录，并持久化保存到项目配置目录")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址")
    parser.add_argument("--port", type=int, default=5000, help="监听端口")
    parser.add_argument("--debug", action="store_true", help="调试模式")
    args = parser.parse_args()

    if args.home:
        os.environ["PDFKIT_HOME"] = args.home
        os.environ["PDFKIT_PERSIST_HOME"] = "1"

    app = create_app()
    print(f"PDF 处理平台 Web 服务启动: http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
