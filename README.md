# PDF 处理平台

一站式 PDF 批处理工具集，提供 **命令行 (CLI)**、**Web 图形界面** 和 **交互式命令行 (REPL)** 三种使用方式。

支持页面尺寸批量缩放、页面删除与提取、ZIP 压缩包转 PDF 等操作，所有写入操作均自动备份原文件，保证安全可逆。

## 功能概览

| 功能 | 说明 |
|------|------|
| **页面缩放** | 将 PDF 页面统一缩放到目标尺寸（mm），支持标准模式和条形漫画模式 |
| **页面删除** | 批量删除指定页码或连续多页，支持从前往后 / 从后往前计数 |
| **提取单页 PNG** | 将指定页导出为高分辨率 PNG 图片 |
| **提取页码范围** | 从 PDF 中截取页码范围，导出为独立 PDF |
| **ZIP 转 PDF** | 将包含图片的 ZIP 压缩包批量转换为 PDF |
| **清理备份** | 一键清理操作产生的备份目录或原始 ZIP 文件 |

## 项目结构

```
mypdf/
├── pdfkit_core/              # 核心业务逻辑
│   ├── config.py             #   全局常量配置
│   ├── utils.py              #   共享工具函数
│   ├── resize.py             #   页面缩放
│   ├── page_ops.py           #   页面删除 / 提取
│   └── converter.py          #   ZIP 转 PDF
├── pdfkit_app/               # Flask Web 应用
│   ├── __init__.py           #   App Factory
│   ├── routes.py             #   Blueprint 路由
│   ├── templates/index.html  #   Web GUI 页面
│   └── static/               #   CSS + JavaScript
├── pdfkit.py                 # CLI 入口
├── pdfkit_repl.py            # 交互式 REPL 入口
├── run.py                    # Web 服务启动入口
└── requirements.txt          # Python 依赖
```

## 环境准备

### 系统依赖

ZIP 转 PDF 功能依赖 [ImageMagick](https://imagemagick.org/) 和 [Poppler](https://poppler.freedesktop.org/)（PNG 提取需要）：

```bash
# macOS
brew install imagemagick poppler

# Ubuntu / Debian
sudo apt install imagemagick poppler-utils
```

### Python 环境

```bash
# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

依赖列表：`pypdf`、`pdf2image`、`tqdm`、`flask`、`prompt_toolkit`

## 使用方式

### 1. 命令行 (CLI)

```bash
python pdfkit.py <command> <folder> [options]
```

#### 页面缩放

```bash
# 批量缩放到 A4（默认 210×297mm）
python pdfkit.py resize ~/pdfs

# 自定义目标尺寸
python pdfkit.py resize ~/pdfs -w 148 -H 210

# 条形漫画模式（仅固定宽度，高度按比例缩放）
python pdfkit.py resize ~/pdfs -w 210 -s

# 只处理单个文件
python pdfkit.py resize ~/pdfs --file comics/vol1.pdf
```

#### 页面删除

```bash
# 删除每个 PDF 的第 1 页
python pdfkit.py delete ~/pdfs -s 1

# 删除最后 3 页
python pdfkit.py delete ~/pdfs -r 3 -b

# 只处理单个文件
python pdfkit.py delete ~/pdfs -s 5 --file doc.pdf
```

#### 页面提取

```bash
# 提取第 1 页为 PNG
python pdfkit.py extract-png ~/pdfs --file doc.pdf --page 1

# 提取第 3-7 页为独立 PDF
python pdfkit.py extract-pdf ~/pdfs --file doc.pdf --start 3 --end 7
```

#### ZIP 转 PDF

```bash
# 批量转换目录下所有 ZIP
python pdfkit.py zip2pdf ~/archives

# 只转换单个文件
python pdfkit.py zip2pdf ~/archives --file manga.zip

# 彩色模式（300 DPI，默认黑白 600 DPI）
python pdfkit.py zip2pdf ~/archives --dpi-mode color
```

#### 清理

```bash
# 清理缩放备份
python pdfkit.py clean ~/pdfs x_backup

# 清理页面操作备份
python pdfkit.py clean ~/pdfs y_backup

# 清理 ZIP 文件
python pdfkit.py clean ~/pdfs zip

# 全部清理
python pdfkit.py clean ~/pdfs all
```

#### 通用选项

| 选项 | 说明 |
|------|------|
| `--file FILE` | 只处理指定文件（相对路径基于目标目录解析） |
| `--open` | 操作完成后用系统文件管理器打开目标目录 |
| `--clean` | 清理对应备份（resize/delete/zip2pdf 均可附加） |

### 2. Web 图形界面

```bash
python run.py [--home /path/to/default-dir] [--host 127.0.0.1] [--port 5000] [--debug]
```

首次或需要变更默认目录时传入 `--home`，程序会创建该目录并持久化保存到项目根目录的 `config/settings.json`。之后不传 `--home` 启动时会继续使用已保存的默认目录。

浏览器访问 `http://localhost:5000`，界面分为三个区域：

- **左侧** — 目录树浏览器，可导航目录、选择文件或目录
- **右侧** — 功能面板，包含缩放 / 删除 / 提取 / 转换 / 清理五个标签页
- **底部** — 实时运行日志输出

左侧目录浏览器以默认目录为操作根目录，不能继续进入其上一级；可通过“打开根目录”按钮返回操作根目录。

选择目录后执行操作会处理目录下所有文件；先选中单个文件则仅处理该文件。

### 3. 交互式命令行 (REPL)

```bash
python pdfkit_repl.py [--cwd /path/to/start]
```

在 REPL 中默认以当前工作目录为操作目标，无需每次输入路径：

```
pdfkit /home/user/pdfs > help

可用命令:
  help             显示帮助信息
  cd               切换工作目录
  ls               列出当前目录下的 PDF/ZIP 文件
  pwd              显示当前工作目录
  resize           页面缩放
  delete           页面删除
  extract-png      提取单页为 PNG
  extract-pdf      提取页码范围为 PDF
  zip2pdf          ZIP 转 PDF
  clean            清理备份目录或 ZIP 文件
  open             在 Finder 中打开当前目录
  exit             退出
```

```
pdfkit /home/user/pdfs > ls
pdfkit /home/user/pdfs > resize -s
pdfkit /home/user/pdfs > delete -s 1
pdfkit /home/user/pdfs > cd ../other_pdfs
pdfkit /home/user/other_pdfs > exit
```

特性：

- **Tab 补全** — 命令名、选项名、文件路径均可自动补全
- **历史记录** — 命令历史持久化到 `~/.pdfkit_history`，跨会话保留
- **目录导航** — `cd` / `ls` / `pwd` 内置命令，操作上下文随目录切换

## 备份机制

所有写入操作采用「先备份后处理」策略，确保原始文件可恢复：

| 操作 | 备份目录 | 命名规则 |
|------|----------|----------|
| 页面缩放 | `x_backup/`（PDF 同级目录） | 与原文件同名 |
| 页面删除 | `y_backup/`（PDF 同级目录） | 与原文件同名 |

- 备份目录中已存在同名文件时自动跳过，保证幂等性
- 处理失败时自动回滚（从备份恢复原文件）
- 扫描时自动排除 `x_backup/` 和 `y_backup/` 目录

## API 参考

Web 服务提供以下 REST API（均为 `POST`，JSON body）：

| 端点 | 参数 | 说明 |
|------|------|------|
| `/api/browse` | `path` | 浏览目录内容 |
| `/api/scan` | `path` | 扫描目录下的 PDF/ZIP 文件 |
| `/api/resize` | `folder`, `file?`, `width`, `height`, `strip` | 页面缩放 |
| `/api/delete` | `folder`, `file?`, `single`, `range`, `back` | 页面删除 |
| `/api/extract-png` | `folder`, `file`, `page`, `dpi_mode` | 提取单页 PNG |
| `/api/extract-pdf` | `folder`, `file`, `start`, `end` | 提取页码范围 |
| `/api/zip2pdf` | `folder`, `file?`, `dpi_mode` | ZIP 转 PDF |
| `/api/clean` | `folder`, `type` | 清理备份/ZIP |
| `/api/open-folder` | `folder` | 打开目录 |

所有操作 API 返回 `{"success": bool, "output": "..."}` 格式。
