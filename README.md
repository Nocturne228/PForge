# PixelForge

PDF 与图片处理平台，提供 **Web 图形界面**、**命令行 (CLI)** 和 **交互式命令行 (REPL)** 三种使用方式。

支持 PDF 页面缩放、删除、提取、ZIP 转 PDF，以及图片拉伸、合并、截取、格式转换、压缩等操作。所有写入操作均自动备份原文件，保证安全可逆。Web 界面内置中英文切换。

## 功能概览

### PDF 工具

| 功能 | 说明 |
|------|------|
| **页面缩放** | 将 PDF 页面统一缩放到目标尺寸（mm），支持标准模式和条形漫画模式 |
| **页面删除** | 批量删除指定页码或连续多页，支持从前往后 / 从后往前计数 |
| **提取单页 PNG** | 将指定页导出为高分辨率 PNG 图片 |
| **提取页码范围** | 从 PDF 中截取页码范围，导出为独立 PDF |
| **元数据编辑** | 读取和修改 PDF 的标题、作者、关键词等元数据 |
| **ZIP 转 PDF** | 将包含图片的 ZIP 压缩包批量转换为 PDF |
| **清理备份** | 一键清理操作产生的备份目录或原始 ZIP 文件 |

### 图片工具

| 功能 | 说明 |
|------|------|
| **图片拉伸** | 按像素或百分比调整图片尺寸，支持保持比例和不放大选项 |
| **图片合并** | 九宫格、上下长条、左右拼接三种合并方式，可选边框 |
| **图片截取** | 拖拽框选区域截取 PNG，支持比例锁定和预览缩放 |
| **格式转换** | PNG / JPG / WEBP 互转，支持单张或批量 |
| **大小压缩** | JPEG 压缩，支持质量调节、最长边限制、目标大小二分搜索 |

## 项目结构

```
pixelforge/
├── pixelforge_core/              # 核心业务逻辑
│   ├── config.py                 #   全局常量配置
│   ├── utils.py                  #   共享工具函数
│   ├── pdf/                      #   PDF 处理模块
│   │   ├── resize.py             #     页面缩放
│   │   ├── page_ops.py           #     页面删除 / 提取 / 元数据
│   │   └── zip_convert.py        #     ZIP 转 PDF
│   └── image/                    #   图片处理模块
│       └── operations.py         #     拉伸 / 合并 / 截取 / 转换 / 压缩
├── pixelforge_web/               # Flask Web 应用
│   ├── __init__.py               #   App Factory
│   ├── config.py                 #   主目录与配置管理
│   ├── security.py               #   路径安全校验
│   ├── streaming.py              #   SSE 流式输出
│   ├── routes.py                 #   通用路由（浏览 / 扫描 / 打开）
│   ├── pdf_routes.py             #   PDF 相关 API
│   ├── image_routes.py           #   图片相关 API
│   ├── static/                   #   前端资源
│   │   ├── translations.js       #     中英文翻译字典
│   │   ├── app.js                #     状态管理与初始化
│   │   ├── api.js                #     API 调用与日志
│   │   ├── browser.js            #     目录浏览器
│   │   ├── pdf-preview.js        #     PDF 预览与元数据
│   │   ├── image-tools.js        #     图片工具交互
│   │   ├── actions.js            #     操作执行
│   │   └── style.css             #     样式
│   └── templates/index.html      #   Web 页面
├── pixelforge.py                 # CLI 入口
├── pixelforge_repl.py            # 交互式 REPL 入口
├── run.py                        # Web 服务启动入口
├── tests/                        # 单元测试
└── requirements.txt              # Python 依赖
```

## 环境准备

### 系统依赖

ZIP 转 PDF 功能依赖 [ImageMagick](https://imagemagick.org/)，PNG 提取依赖 [Poppler](https://poppler.freedesktop.org/)：

```bash
# macOS
brew install imagemagick poppler

# Ubuntu / Debian
sudo apt install imagemagick poppler-utils
```

### Python 环境

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

依赖列表：`pypdf`、`pdf2image`、`tqdm`、`flask`、`prompt_toolkit`、`pillow`

## 使用方式

### 1. Web 图形界面

```bash
python run.py [--home /path/to/default-dir] [--host 127.0.0.1] [--port 5000] [--debug]
```

首次或需要变更默认目录时传入 `--home`，程序会创建该目录并持久化保存到 `config/settings.json`。之后不传 `--home` 启动时会继续使用已保存的默认目录。

浏览器访问 `http://localhost:5000`，界面特性：

- **PDF / 图片模式切换** — 点击左上角 `p` 标识在 PDF 和 Pic 模式间切换
- **目录浏览器** — 左侧导航目录、选择文件，支持列表和卡片两种视图
- **PDF 预览** — 选中 PDF 后右侧实时预览，支持元数据查看和编辑
- **图片预览** — 选中图片后右侧显示预览，截取工具支持拖拽框选和缩放
- **实时日志** — 底部终端风格日志输出，自动分类着色
- **中英文切换** — 右上角语言按钮一键切换，偏好自动保存

环境变量：

| 变量 | 说明 |
|------|------|
| `PIXELFORGE_HOME` | 覆盖默认目录 |
| `PIXELFORGE_PERSIST_HOME` | 设为 `1` 时持久化 HOME 到配置文件 |
| `PIXELFORGE_ALLOWED_ROOTS` | 冒号分隔的允许访问路径列表 |

### 2. 命令行 (CLI)

```bash
python pixelforge.py <command> <folder> [options]
```

#### 页面缩放

```bash
python pixelforge.py resize ~/pdfs                        # A4 默认
python pixelforge.py resize ~/pdfs -w 148 -H 210          # 自定义尺寸
python pixelforge.py resize ~/pdfs -w 210 -s              # 条形漫画模式
python pixelforge.py resize ~/pdfs --file comics/vol1.pdf # 单文件
```

#### 页面删除

```bash
python pixelforge.py delete ~/pdfs -s 1           # 删除第 1 页
python pixelforge.py delete ~/pdfs -r 3 -b        # 删除最后 3 页
python pixelforge.py delete ~/pdfs -s 5 --file doc.pdf
```

#### 页面提取

```bash
python pixelforge.py extract-png ~/pdfs --file doc.pdf --page 1
python pixelforge.py extract-pdf ~/pdfs --file doc.pdf --start 3 --end 7
```

#### ZIP 转 PDF

```bash
python pixelforge.py zip2pdf ~/archives                    # 批量转换
python pixelforge.py zip2pdf ~/archives --file manga.zip   # 单文件
python pixelforge.py zip2pdf ~/archives --dpi-mode color   # 彩色 300 DPI
```

#### 清理

```bash
python pixelforge.py clean ~/pdfs backup_resize      # 缩放备份
python pixelforge.py clean ~/pdfs backup_page_ops    # 页面操作备份
python pixelforge.py clean ~/pdfs zip                # ZIP 文件
python pixelforge.py clean ~/pdfs output_images      # 图片输出目录
python pixelforge.py clean ~/pdfs all                # 全部清理
```

#### 通用选项

| 选项 | 说明 |
|------|------|
| `--file FILE` | 只处理指定文件 |
| `--open` | 操作完成后打开目标目录 |
| `--clean` | 清理对应备份 |

### 3. 交互式命令行 (REPL)

```bash
python pixelforge_repl.py [--cwd /path/to/start]
```

```
pixelforge /home/user/pdfs > help

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

特性：

- **Tab 补全** — 命令名、选项名、文件路径均可自动补全
- **历史记录** — 命令历史持久化到 `~/.pixelforge_history`
- **目录导航** — `cd` / `ls` / `pwd` 内置命令

## 备份机制

所有写入操作采用「先备份后处理」策略，确保原始文件可恢复：

| 操作 | 目录 | 命名规则 |
|------|------|----------|
| 页面缩放 | `backup_resize/`（PDF 同级目录） | 与原文件同名 |
| 页面删除 | `backup_page_ops/`（PDF 同级目录） | 与原文件同名 |
| 图片处理 | `output_images/`（图片同级目录） | 按操作类型生成新文件名 |

- 备份目录中已存在同名文件时自动跳过，保证幂等性
- 处理失败时自动回滚（从备份恢复原文件）
- 扫描时自动排除 `backup_resize/`、`backup_page_ops/` 和 `output_images/` 目录

## API 参考

Web 服务提供以下 REST API（均为 `POST`，JSON body）：

### 通用

| 端点 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/browse` | POST | `path` | 浏览目录内容 |
| `/api/scan` | POST | `path` | 扫描目录下的 PDF/ZIP 文件 |
| `/api/home` | GET | — | 获取当前主目录 |
| `/api/open-folder` | POST | `folder` | 用系统文件管理器打开目录 |
| `/api/shutdown` | POST | — | 关闭服务 |

### PDF

| 端点 | 参数 | 说明 |
|------|------|------|
| `/api/resize` | `folder`, `file?`, `width`, `height`, `strip` | 页面缩放 |
| `/api/delete` | `folder`, `file?`, `single`/`range`/`range_start`+`range_end`, `back` | 页面删除 |
| `/api/extract-png` | `folder`, `file`, `page`, `dpi_mode` | 提取单页 PNG |
| `/api/extract-pdf` | `folder`, `file`, `start`, `end` | 提取页码范围 |
| `/api/crop-png` | `folder`, `file`, `page`, `crop`, `dpi` | 裁剪 PDF 页面为 PNG |
| `/api/pdf-metadata` | `folder`, `file` | 读取元数据 |
| `/api/pdf-metadata-save` | `folder`, `file`, `metadata` | 保存元数据 |
| `/api/zip2pdf` | `folder`, `file?`, `dpi_mode` | ZIP 转 PDF |
| `/api/clean` | `folder`, `type` | 清理备份/ZIP |
| `/api/pdf-file` | GET `path` | 获取 PDF 文件 |
| `/api/page-image` | GET `path`, `page`, `dpi` | 渲染 PDF 页面为 PNG |
| `/api/pdf-info` | `path` | PDF 基本信息 |

### 图片

| 端点 | 参数 | 说明 |
|------|------|------|
| `/api/image-resize` | `folder`, `file`, `width`, `height`, `mode`, `keep_ratio`, `no_enlarge` | 图片拉伸 |
| `/api/image-merge` | `folder`, `mode`, `border` | 图片合并 |
| `/api/image-crop` | `folder`, `file`, `crop`, `output?` | 图片截取 |
| `/api/image-convert` | `folder`, `file?`, `scope`, `format` | 格式转换 |
| `/api/image-compress` | `folder`, `file?`, `scope`, `quality`, `max_side?`, `target_kb?` | 图片压缩 |
| `/api/image-file` | GET `path` | 获取图片文件 |

所有路径参数均受 `PIXELFORGE_ALLOWED_ROOTS` 安全校验约束。
