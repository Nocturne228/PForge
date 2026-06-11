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
├── run.py                        # Web 服务启动入口
├── pixelforge.py                 # CLI 命令行入口
├── pixelforge_repl.py            # 交互式 REPL 入口
├── requirements.txt              # Python 依赖
├── config/
│   └── settings.json             # 运行时配置（持久化的 HOME 路径）
│
├── pixelforge_core/              # 核心业务逻辑（纯 Python，无 Web 依赖）
│   ├── __init__.py               #   统一导出所有核心函数
│   ├── config.py                 #   全局常量（排除目录、备份目录、DPI、图片扩展名）
│   ├── utils.py                  #   共享工具（OperationResult、ProgressLogger、路径解析、批处理框架）
│   ├── pdf/                      #   PDF 处理模块
│   │   ├── __init__.py           #     聚合导出 PDF 子模块函数
│   │   ├── resize.py             #     页面缩放（单文件/批量 + 备份管理）
│   │   ├── page_ops.py           #     页面删除/提取/裁剪/元数据/渲染
│   │   └── zip_convert.py        #     ZIP 转 PDF（解压 → 校验 → ImageMagick 转换）
│   └── image/                    #   图片处理模块
│       ├── __init__.py           #     聚合导出图片子模块函数
│       ├── common.py             #     图片 I/O 工具（加载、保存、批量列表、损坏检测、filter_valid_images）
│       ├── resize.py             #     图片拉伸（像素/百分比模式）
│       ├── merge.py              #     图片合并（九宫格/上下/左右）
│       ├── crop.py               #     图片截取（归一化坐标裁剪）
│       ├── convert.py            #     格式转换（PNG/JPG/WEBP 互转）
│       ├── compress.py           #     JPEG 压缩（质量调节 + 二分搜索目标大小）
│       └── cleanup.py            #     清理 output_images 输出目录
│
├── pixelforge_web/               # Flask Web 应用
│   ├── __init__.py               #   App Factory（create_app）
│   ├── config.py                 #   主目录管理、配置持久化、允许路径
│   ├── security.py               #   路径安全校验（ALLOWED_ROOTS 白名单）
│   ├── route_helpers.py          #   路由通用函数（参数校验、错误响应）
│   ├── streaming.py              #   SSE 流式输出（StreamBuf + stream_task）
│   ├── routes.py                 #   通用路由（浏览/扫描/打开目录/关闭）
│   ├── pdf_routes.py             #   PDF API 路由
│   ├── image_routes.py           #   图片 API 路由
│   ├── static/                   #   前端资源
│   │   ├── translations.js       #     中英文翻译字典 + i18n 切换
│   │   ├── api.js                #     API 调用封装 + 日志渲染
│   │   ├── app.js                #     全局状态 (PF) + 事件绑定 + 初始化
│   │   ├── actions.js            #     操作状态管理（按钮禁用/启用）
│   │   ├── browser.js            #     目录浏览器（列表/卡片视图、面包屑）
│   │   ├── pdf-preview.js        #     PDF 预览 + 元数据编辑 + Tab/页面切换
│   │   ├── pdf-tools.js          #     PDF 工具操作（缩放/删除/提取/ZIP 转 PDF/清理）
│   │   ├── image-preview.js      #     图片预览（加载、缩放、布局同步）
│   │   ├── image-crop.js         #     图片截取工具（拖拽框选、比例锁定、缩放）
│   │   ├── image-resize.js       #     图片拉伸工具（像素/百分比、锁定比例）
│   │   ├── image-batch-tools.js  #     图片批量工具（合并、格式转换、压缩）
│   │   └── style.css             #     全局样式
│   └── templates/
│       └── index.html            #   单页 Web 界面
│
└── tests/                        # 单元测试
    ├── test_pdf_ops.py           #   PDF 操作测试（页面删除/提取/元数据/备份回滚）
    ├── test_image_ops.py         #   图片操作集成测试
    ├── test_safety.py            #   安全校验测试（ZIP 路径穿越、路径白名单）
    └── test_frontend_contracts.py #  前端结构合约测试（脚本加载顺序、DOM ID、状态封装）
```

## 模块详解

### pixelforge_core — 核心业务逻辑

纯 Python 模块，不依赖 Flask，可被 CLI / REPL / Web 三种入口复用。

#### config.py — 全局常量

定义所有模块共享的常量：

| 常量 | 值 | 用途 |
|------|-----|------|
| `EXCLUDE_DIRS` | `{"backup_resize", "backup_page_ops", "output_images"}` | 扫描时排除的目录 |
| `BACKUP_DIR_RESIZE` | `"backup_resize"` | 页面缩放备份目录名 |
| `BACKUP_DIR_PAGE_OPS` | `"backup_page_ops"` | 页面操作备份目录名 |
| `OUTPUT_DIR_IMAGES` | `"output_images"` | 图片输出目录名 |
| `DPI_PRESETS` | `{"bw": 600, "color": 300}` | DPI 预设映射 |
| `IMAGE_EXTENSIONS` | `{".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}` | 可识别的图片扩展名 |

#### utils.py — 共享工具

| 函数/类 | 说明 |
|---------|------|
| `OperationResult` | dataclass，统一的操作结果记录器：`total`、`success`、`skipped`、`failed`、`corrupted`、`outputs`。`ok` 属性返回是否无失败 |
| `ProgressLogger` | 结构化进度输出类，提供 `info`/`progress`/`error`/`skip`/`section`/`report`/`done`/`blank` 方法，替代散落的 `print()` 调用。模块级实例 `log` 可直接导入使用 |
| `batch_with_backup(files, backup_dir_name, process_fn, ...)` | 通用「先备份后处理」批处理框架。自动处理备份/跳过/回滚/进度报告，PDF 缩放和删除均基于此函数 |
| `clean_dirs_by_name(root, dir_name)` | 递归删除指定名称的子目录，三个 clean 函数均委托于此 |
| `open_folder(path)` | 跨平台打开文件管理器（macOS/Windows/Linux） |
| `resolve_pdf_file(root, file_arg, exclude_dirs)` | 解析并验证 PDF 文件路径，确保在 root 内且非备份目录 |
| `resolve_output_path(root, pdf_path, output_arg, default_name)` | 解析输出路径，确保在 root 内 |
| `resolve_dpi(mode, presets)` | 将 DPI 模式名映射到具体数值 |
| `available_output_path(path)` | 文件已存在时自动追加数字后缀生成唯一路径 |
| `natural_key(path)` | 自然排序键（`page1 < page2 < page10`） |

#### pdf/resize.py — PDF 页面缩放

核心流程：先备份原文件到 `backup_resize/`，再从备份读取并缩放写入原位置。失败时自动回滚。

| 函数 | 说明 |
|------|------|
| `_resize_single_pdf(input, output, w, h, strip_mode)` | 缩放单个 PDF，使用 `pypdf.Transformation` 变换 |
| `_batch_resize(files, w, h, strip_mode)` | 批量缩放，含跳过/备份/回滚逻辑 |
| `resize_folder(path, w, h, strip)` | 递归扫描目录下所有 PDF 并批量缩放 |
| `resize_file(path, file, w, h, strip)` | 缩放指定单文件 |
| `clean_resize_backups(path)` | 递归删除所有 `backup_resize/` 目录 |

**缩放模式**：标准模式将页面缩放到目标宽高并居中；条形漫画模式仅固定宽度，高度按比例自适应。

#### pdf/page_ops.py — 页面操作与元数据

| 函数 | 说明 |
|------|------|
| `_delete_pdf_pages(input, output, single, range, ...)` | 删除指定页面（单页/前N/后N/范围） |
| `_extract_pdf_page_to_png(pdf, page, output, dpi)` | 使用 `pdf2image` 渲染单页为 PNG |
| `_extract_pdf_pages_range(pdf, start, end, output)` | 提取页码范围为新 PDF |
| `_render_pdf_page(pdf, page, dpi)` | 渲染页面为 PIL Image（供预览用） |
| `_crop_pdf_page_to_png(pdf, page, crop_box, output, dpi)` | 渲染页面后裁剪指定区域为 PNG |
| `delete_folder` / `delete_file` | 批量/单文件页面删除（含备份） |
| `extract_png` / `extract_pdf` | 提取操作的外部入口 |
| `render_page_image` / `crop_png` | 渲染/裁剪操作的外部入口 |
| `get_pdf_metadata` / `update_pdf_metadata` | 读写 PDF 元数据（Title/Author/Subject/Keywords/Creator/Producer） |
| `clean_page_backups(path)` | 递归删除所有 `backup_page_ops/` 目录 |

#### pdf/zip_convert.py — ZIP 转 PDF

核心流程：解压 ZIP → 校验图片（使用 ImageMagick `identify`）→ 调用 `magick` 命令转换。

| 函数 | 说明 |
|------|------|
| `_safe_extract(zip, out_dir)` | 安全解压，阻止路径穿越攻击 |
| `_find_images(folder)` | 递归查找图片文件并按自然排序 |
| `_diagnose_image(path)` | 使用 ImageMagick 检测图片是否有效 |
| `_images_to_pdf(images, output, dpi)` | 调用 `magick` 命令将图片批量转 PDF，实时解析进度 |
| `_process_single_zip(zip, dpi)` | 处理单个 ZIP 的完整流程 |
| `zip_folder` / `zip_file` | 批量/单文件转换入口 |
| `clean_zip_files(path)` | 删除目录下所有 `.zip` 文件 |

#### image/common.py — 图片 I/O 工具

所有图片操作共享的底层函数：

| 函数 | 说明 |
|------|------|
| `output_dir(root)` | 获取/创建 `output_images/` 目录 |
| `resolve_image_file(root, file_arg)` | 解析验证图片路径 |
| `list_images(root)` | 列出目录下所有图片（自然排序） |
| `save_image(image, path, quality)` | 根据扩展名选择格式保存（JPEG 转 RGB、WEBP method=6） |
| `jpeg_bytes(image, quality)` | 将图片编码为 JPEG 字节（用于二分搜索压缩） |
| `load_image(path)` | 加载图片并自动 EXIF 旋转 |
| `try_load_image(path)` | 安全加载，失败时返回 `(None, error)` |
| `filter_valid_images(paths)` | 批量加载验证图片，返回 `(loaded, corrupted)`，`loaded` 为 `(path, RGB Image)` 元组列表 |
| `print_corrupted(files)` | 输出损坏文件列表 |

#### image/resize.py — 图片拉伸

`image_resize(folder, file, width, height, mode, keep_ratio, no_enlarge)` — 支持像素/百分比两种模式，可组合保持比例和不放大选项。输出到 `output_images/` 目录。

#### image/merge.py — 图片合并

`image_merge(folder, mode, border)` — 合并当前目录下所有图片：
- `grid` — 三列九宫格布局，单元格取最大宽高
- `vertical` — 上下纵向拼接
- `horizontal` — 左右横向拼接

自动跳过损坏文件，支持可选边框/间距（8px，浅灰色）。

#### image/crop.py — 图片截取

`image_crop(folder, file, crop_box, output)` — 接收归一化坐标 `{x, y, width, height}`（0~1），转换为实际像素坐标后裁剪。

#### image/convert.py — 格式转换

`image_convert(folder, file, target_format)` — 支持 PNG/JPG/WEBP 互转。`file` 为 None 时批量处理目录下所有图片。

#### image/compress.py — JPEG 压缩

`image_compress(folder, file, quality, max_side, target_kb, best_quality)` — 核心特性：
- `max_side` — 最长边限制，超限时使用 `thumbnail` 缩放
- `target_kb` — 二分搜索最优质量值，使输出不超过目标大小
- `best_quality` — 强制使用 quality=95 作为搜索上限

#### image/cleanup.py — 清理输出

`clean_image_outputs(folder)` — 递归删除所有 `output_images/` 目录。

### pixelforge_web — Flask Web 应用

#### __init__.py — App Factory

`create_app()` 创建 Flask 实例，注册四个 Blueprint：

| Blueprint | URL 前缀 | 说明 |
|-----------|----------|------|
| `main_bp` | `/` | 页面渲染、静态文件 |
| `api_bp` | `/api` | 通用 API（浏览/扫描/打开/关闭） |
| `pdf_api_bp` | `/api` | PDF 相关 API |
| `image_api_bp` | `/api` | 图片相关 API |

#### config.py — 配置管理

| 函数/常量 | 说明 |
|-----------|------|
| `get_home_dir()` | 按优先级获取主目录：环境变量 > 配置文件 > 默认 `/tmp` |
| `ensure_default_dirs(home)` | 确保主目录和 `.work` 子目录存在 |
| `get_allowed_roots(home)` | 解析允许访问的路径白名单 |
| `VISIBLE_FILE_EXTENSIONS` | 目录浏览中可见的文件类型 |
| `MAX_SCAN_RESULTS` | 扫描结果上限（5000） |

注意：`HOME_DIR` 和 `ALLOWED_ROOTS` 在 `create_app()` 中初始化并存入 `app.config`，避免模块导入时的副作用。

#### security.py — 路径安全

| 函数 | 说明 |
|------|------|
| `resolve_allowed_path(path)` | 验证路径是否在 `ALLOWED_ROOTS` 白名单内，否则抛出 `PermissionError` |
| `path_error_response(exc)` | 将 `PermissionError` / `OSError` 转为 HTTP 403/400 响应 |

#### route_helpers.py — 路由工具函数

| 函数 | 说明 |
|------|------|
| `json_error(message, status)` | 构造 JSON 错误响应 |
| `resolve_folder_arg(value)` | 校验并解析文件夹参数，返回 `(path, error)` |
| `resolve_file_arg(value, suffixes, kind_label)` | 校验并解析文件参数，验证扩展名 |

#### streaming.py — SSE 流式输出

Web 操作的实时反馈机制：

| 函数/类 | 说明 |
|---------|------|
| `StreamBuf` | 线程安全的 stdout 捕获器。`\n` 输出为普通日志行，`\r` 输出为可替换行（用于进度更新） |
| `stream_task(func, *args)` | 在后台线程运行 `func`，将 stdout 通过 SSE（Server-Sent Events）流式推送给浏览器 |
| `capture(func, *args)` | 非流式捕获，用于简单端点（如打开目录） |

**SSE 数据格式**：每行 `data: {"line": "...", "replace": bool}` 或 `data: {"done": true, "success": bool, "result": {...}}`

#### routes.py — 通用路由

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 渲染 index.html |
| `/api/browse` | POST | 浏览目录内容（子目录 + 可见文件） |
| `/api/scan` | POST | 递归扫描 PDF/ZIP 文件 |
| `/api/home` | GET | 返回当前主目录 |
| `/api/open-folder` | POST | 用系统文件管理器打开目录 |
| `/api/shutdown` | POST | 延迟 0.5s 关闭服务 |

#### pdf_routes.py — PDF API 路由

所有耗时操作通过 `stream_task` 实现 SSE 流式输出。

| 端点 | 说明 |
|------|------|
| `/api/resize` | 页面缩放 |
| `/api/delete` | 页面删除 |
| `/api/extract-png` | 提取单页 PNG |
| `/api/extract-pdf` | 提取页码范围 |
| `/api/crop-png` | 裁剪 PDF 页面为 PNG |
| `/api/pdf-metadata` | 读取元数据 |
| `/api/pdf-metadata-save` | 保存元数据 |
| `/api/zip2pdf` | ZIP 转 PDF |
| `/api/clean` | 清理备份/ZIP/输出 |
| `/api/pdf-file` (GET) | 提供 PDF 文件下载 |
| `/api/page-image` (GET) | 渲染 PDF 页面为 PNG |
| `/api/pdf-info` | 获取 PDF 基本信息（页数、尺寸、大小） |

#### image_routes.py — 图片 API 路由

| 端点 | 说明 |
|------|------|
| `/api/image-resize` | 图片拉伸 |
| `/api/image-merge` | 图片合并 |
| `/api/image-crop` | 图片截取 |
| `/api/image-convert` | 格式转换 |
| `/api/image-compress` | 图片压缩 |
| `/api/image-file` (GET) | 提供图片文件 |

### 前端架构

前端为无框架的原生 JavaScript 单页应用，通过 `<script>` 标签按序加载。

#### 脚本加载顺序与职责

```
translations.js → api.js → actions.js → app.js → browser.js →
pdf-preview.js → pdf-tools.js → image-preview.js → image-crop.js →
image-resize.js → image-batch-tools.js
```

| 文件 | 职责 |
|------|------|
| `translations.js` | 中英文翻译字典 `T`，`t(key)` 查翻译，`applyTranslations()` 应用到 DOM，`switchLanguage()` 切换语言 |
| `api.js` | `api(endpoint, data)` 普通 JSON 请求、`apiStream(endpoint, data, onLine)` SSE 流式请求、`log(msg, replace)` 日志渲染（自动分类着色）、`escapeHtml`/`normalizePath`/`formatSize` 等工具函数 |
| `actions.js` | `setButtonsDisabled(disabled)` 操作进行中的按钮状态管理 |
| `app.js` | 全局状态变量（`currentPath`/`selectedPath`/`selectedType`/`isRunning`/`viewMode` 等）、`runToolAction()` 统一操作执行器、所有事件绑定函数、`DOMContentLoaded` 初始化 |
| `browser.js` | `navigateTo(path)` 目录导航、`renderFileTree(data)` 列表/卡片渲染、`updateBreadcrumb()` 面包屑、`scanDirectory()` / `refreshDirectory()` |
| `pdf-preview.js` | `showPdfPreview()` PDF 内嵌预览、`loadPdfMetadata()` / `savePdfMetadata()` 元数据读写、`switchMainPage()` / `switchToTab()` / `switchImageTab()` 页面切换 |
| `pdf-tools.js` | `doResize()` / `doDelete()` / `doExtract()` / `doZip2pdf()` / `doCleanType()` — PDF 工具操作触发函数 |
| `image-preview.js` | `loadImageInfoForResize()` 加载图片信息、`setImagePreviewMode()` 预览模式切换、`syncImagePreviewLayout()` 布局同步、缩放控制 |
| `image-crop.js` | 图片截取工具完整实现：拖拽绘制/移动/缩放裁剪框、比例约束、归一化坐标计算、`saveImageCrop()` 保存 |
| `image-resize.js` | `setImageResizeMode()` 像素/百分比切换、`updateResizeCalcDisplay()` 实时计算输出尺寸、`doImageResize()` 执行拉伸 |
| `image-batch-tools.js` | `doImageMerge()` / `doImageConvert()` / `doImageCompress()` — 批量图片操作 |

#### 全局状态

所有前端状态封装在 `window.PF` 命名空间中，其他 JS 文件通过 `PF.xxx` 访问：

| 属性 | 说明 |
|------|------|
| `PF.currentPath` | 当前浏览的目录路径 |
| `PF.selectedPath` | 当前选中的文件路径 |
| `PF.selectedType` | 选中文件类型（`"dir"` / `"pdf"` / `"zip"` / `"image"`） |
| `PF.isRunning` | 操作是否正在执行 |
| `PF.viewMode` | 目录视图模式（`"list"` / `"card"`） |
| `PF.rootPath` | 操作根目录（从 HTML data 属性获取） |
| `PF.imagePreviewState` | 图片预览状态（已加载路径、原始宽高、基准宽度） |
| `PF.imageCropState` | 截取状态（裁剪框 rect、拖拽信息 drag、缩放 zoom） |
| `PF.imageResizeMode` | 拉伸模式（`"pixel"` / `"percent"`） |
| `PF.imageResizeLockRatio` | 是否锁定拉伸比例 |

#### 日志系统

`api.js` 中的 `classifyLogLine()` 根据消息内容自动分类：

| 类型 | 匹配关键词 | 样式 |
|------|-----------|------|
| `error` | `[错误]`、`失败`、`超时` | 红色 |
| `warning` | `[跳过]`、`警告` | 黄色 |
| `success` | `完成`、`成功`、`已保存` | 绿色 |
| `progress` | `进度` | 蓝色 |
| `summary` | `报告`、`文件总数` | 加粗 |
| `active` | `开始`、`正在` | 高亮 |
| `path` | `扫描目录`、`指定文件` | 暗色 |

### 入口文件

#### run.py — Web 启动

解析 `--home`/`--host`/`--port`/`--debug` 参数，调用 `create_app()` 启动 Flask。`--home` 会设置环境变量并触发配置持久化。

#### pixelforge.py — CLI

使用 `argparse` 定义 6 个子命令（`resize`/`delete`/`extract-png`/`extract-pdf`/`zip2pdf`/`clean`），每个子命令对应一个 `cmd_*` 函数。

#### pixelforge_repl.py — REPL

`PixelForgeREPL` 类封装交互式命令行，`PixelForgeCompleter` 实现 Tab 补全（命令名、选项、文件路径）。命令历史持久化到 `~/.pixelforge_history`。

## 架构设计

### 三层分离

```
┌────────────────────────────────────────────┐
│           入口层 (run.py / pixelforge.py /  │
│                    pixelforge_repl.py)       │
├────────────────────────────────────────────┤
│           Web 层 (pixelforge_web/)           │
│   Flask 路由 → 参数校验 → 调用核心函数       │
│   SSE 流式输出 → 浏览器实时日志              │
├────────────────────────────────────────────┤
│           核心层 (pixelforge_core/)          │
│   纯 Python，通过 ProgressLogger 输出进度   │
│   返回 OperationResult 记录操作结果          │
└────────────────────────────────────────────┘
```

核心层通过 `ProgressLogger`（`log` 实例）输出进度信息，Web 层的 `StreamBuf` 捕获这些输出并通过 SSE 推送到浏览器，CLI 层则直接显示在终端。

### 备份机制

所有 PDF 写入操作采用「先备份后处理」策略：

1. 在 PDF 同级目录创建 `backup_*` 子目录
2. 将原文件 `rename` 到备份目录
3. 从备份读取处理，输出到原位置
4. 处理失败时自动 `rename` 回滚

备份目录中已存在同名文件时自动跳过，保证幂等性。图片操作不备份，输出到独立的 `output_images/` 目录。

### 安全模型

- 路径白名单：所有文件访问路径必须在 `ALLOWED_ROOTS` 范围内
- ZIP 路径穿越防护：`_safe_extract` 校验解压目标不超出临时目录
- 备份目录隔离：扫描和处理自动排除 `backup_*` 和 `output_images`
- 文件类型校验：`resolve_file_arg` 验证扩展名匹配

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

## 开发指南

### 添加新的 PDF 操作

1. 在 `pixelforge_core/pdf/` 下创建新模块，实现核心函数，返回 `OperationResult`
2. 在 `pixelforge_core/pdf/__init__.py` 中导出
3. 在 `pixelforge_core/__init__.py` 中导出
4. 在 `pixelforge_web/pdf_routes.py` 中添加路由，使用 `stream_task` 包装
5. 在 `pixelforge_web/static/pdf-tools.js` 中添加前端触发函数
6. 在 `pixelforge_web/templates/index.html` 中添加 UI 面板
7. 在 `translations.js` 中添加中英文翻译

### 添加新的图片操作

1. 在 `pixelforge_core/image/` 下创建新模块，使用 `common.py` 中的 I/O 工具
2. 在 `pixelforge_core/image/__init__.py` 中导出
3. 在 `pixelforge_core/__init__.py` 中导出
4. 在 `pixelforge_web/image_routes.py` 中添加路由
5. 在对应的前端 JS 文件中添加触发函数
6. 在 `index.html` 中添加 UI 并更新 `translations.js`

### 测试

```bash
python -m pytest tests/ -v
```

| 测试文件 | 覆盖范围 |
|---------|---------|
| `test_pdf_ops.py` | PDF 页面删除（各模式）、备份/回滚行为、页码提取、元数据读写、`batch_with_backup` 通用行为 |
| `test_image_ops.py` | 图片操作的输入输出、损坏文件跳过、全损坏边界情况 |
| `test_safety.py` | ZIP 路径穿越防护、删除参数校验、StreamBuf 行为、路由路径校验 |
| `test_frontend_contracts.py` | 前端脚本加载顺序、DOM ID 结构、工具函数存在性、PF 状态封装 |

### 关键约定

- 核心函数使用 `ProgressLogger`（`log` 实例）输出进度，Web 层通过 `StreamBuf` 捕获
- 批量操作返回 `OperationResult`，单文件操作也可返回 `Path` 或布尔值
- PDF 批量操作统一使用 `batch_with_backup()` 框架，自动处理备份/跳过/回滚
- 图片批量操作使用 `filter_valid_images()` 统一加载和损坏检测
- 清理操作统一委托 `clean_dirs_by_name()`
- 所有路径操作必须经过安全校验（`resolve_allowed_path` / `resolve_pdf_file`）
- 前端操作统一通过 `runToolAction()` 执行，自动管理按钮状态和日志输出
- 前端全局状态封装在 `PF` 对象中，所有 JS 文件通过 `PF.xxx` 访问
- 前端翻译使用 `data-i18n` / `data-i18n-title` / `data-i18n-placeholder` 属性

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
