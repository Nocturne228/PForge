// =====================================================
// i18n Translations & Language Switching
// =====================================================

var currentLang = localStorage.getItem("pixelforge_lang") || "zh";

var T = {
    zh: {
        // Header
        "modePill.title": "点击切换 PDF / 图片模式",
        "shutdownBtn": "关闭服务",
        "shutdownBtn.title": "关闭服务",
        // Sidebar
        "sidebar.title": "目录浏览",
        "viewToggleBtn.title": "切换卡片视图",
        "rootBtn.title": "返回操作根目录",
        "openFolderBtn.title": "用系统文件管理器打开当前目录",
        "scanBtn": "扫描 PDF / ZIP",
        "refreshBtn": "刷新目录",
        "fileTree.loading": "加载中...",
        // Selection info
        "selectionInfo": "请在左侧选择一个目录或文件",
        "selectionInfo.dir": "目录",
        "selectionInfo.pdf": "PDF 文件",
        "selectionInfo.zip": "ZIP 文件",
        "selectionInfo.image": "图片文件",
        "selectionInfo.other": "文件",
        "selectionInfo.selected": "已选择: ",
        // PDF tabs
        "tab.resize": "页面缩放",
        "tab.delete": "页面删除",
        "tab.extract": "页面提取",
        "tab.metadata": "元数据",
        "tab.zip2pdf": "ZIP 转 PDF",
        "tab.clean": "清理",
        // PDF preview
        "pdfPreviewName": "未选择 PDF",
        "pdfPreviewName.selected": "已选择 PDF",
        "previewPlaceholder": "选择左侧目录中的 PDF 文件即可预览",
        "preview.loading": "加载中...",
        "preview.loadError": "预览加载失败:",
        "preview.pages": "页",
        "metadata.loading": "元数据读取中...",
        "metadata.readError": "元数据读取失败:",
        "metadata.saving": "保存中...",
        "metadata.saved": "元数据已保存",
        "metadata.saveFailed": "元数据保存失败",
        "metadata.pages": "页",
        // Resize
        "panel-resize.h3": "页面缩放",
        "resizeWidth.label": "目标宽度 (mm)",
        "resizeHeight.label": "目标高度 (mm)",
        "resizeStrip.label": "条形漫画模式（仅固定宽度，高度自适应）",
        "resizeBtn": "执行缩放",
        // Delete
        "panel-delete.h3": "页面删除",
        "deleteMode.label": "删除模式",
        "deleteMode.single": "单页",
        "deleteMode.range": "前/后N页",
        "deleteMode.range-se": "页码范围",
        "deleteCount.label": "页码 / 页数",
        "deleteStart.label": "起始页",
        "deleteEnd.label": "结束页",
        "deleteBack.label": "方向",
        "deleteBack.front": "前",
        "deleteBack.back": "后",
        "deleteBtn": "执行删除",
        // Extract
        "panel-extract.h3": "页面提取",
        "extractMode.label": "提取模式",
        "extractMode.png": "→ PNG",
        "extractMode.pdf": "→ PDF",
        "extractDpi.label": "DPI 模式",
        "extractDpi.bw": "黑白",
        "extractDpi.color": "彩色",
        "extractPage.label": "页码",
        "extractStart.label": "起始页",
        "extractEnd.label": "结束页",
        "extractBtn": "执行提取",
        // Metadata
        "panel-metadata.h3": "元数据",
        "metadataPlaceholder": "请先在左侧选择一个 PDF 文件",
        "metaTitle.label": "标题",
        "metaAuthor.label": "作者",
        "metaSubject.label": "主题",
        "metaKeywords.label": "关键词",
        "metaCreator.label": "创建程序",
        "metaProducer.label": "生成程序",
        "metadataSaveBtn": "保存元数据",
        "metadataReloadBtn": "重新读取",
        // ZIP
        "panel-zip2pdf.h3": "ZIP 转 PDF",
        "zipDpi.label": "DPI 模式",
        "zipDpi.bw": "黑白",
        "zipDpi.color": "彩色",
        "zip2pdfBtn": "执行转换",
        // Clean
        "panel-clean.h3": "清理",
        "cleanType.label": "清理类型",
        "cleanType.x_backup": "缩放备份",
        "cleanType.y_backup": "页面备份",
        "cleanType.zip": "ZIP",
        "cleanType.all": "全部",
        "cleanBtn": "执行清理",
        // Image tabs
        "tab.image.resize": "图片拉伸",
        "tab.image.merge": "图片合并",
        "tab.image.crop": "图片截取",
        "tab.image.convert": "格式转换",
        "tab.image.compress": "大小压缩",
        // Image preview
        "imagePreviewName": "未选择图片",
        "imagePreviewEmpty": "请先在左侧选择一张图片文件",
        "imageCropPlaceholder": "选择左侧图片后即可拖拽框选",
        // Image resize
        "image-panel-resize.h3": "图片拉伸",
        "imageResizeMode.label": "调整方式",
        "imageResizeMode.pixel": "按像素",
        "imageResizeMode.percent": "按百分比",
        "imageResizeWidthLabel": "宽度 (px)",
        "imageResizeWidthLabel.percent": "宽度 (%)",
        "imageResizeHeightLabel": "高度 (px)",
        "imageResizeHeightLabel.percent": "高度 (%)",
        "imageResizeKeepRatio": "保持比例",
        "imageResizeNoEnlarge": "不放大",
        "imageResizeSummary.size": "输出尺寸",
        "imageResizeSummary.ratio": "输出比例",
        "imageResizeBtn": "保存拉伸图片",
        "imageResizeResetBtn": "重置设置",
        // Image merge
        "image-panel-merge.h3": "图片合并",
        "imageMergeMode.label": "合并方式",
        "imageMergeMode.grid": "九宫格",
        "imageMergeMode.vertical": "上下",
        "imageMergeMode.horizontal": "左右",
        "imageMergeBorder": "添加边框 / 间距",
        "imageMergeBtn": "合并当前目录图片",
        // Image crop
        "image-panel-crop.h3": "图片截取",
        "imageCropRatio.label": "截取比例",
        "imageCropRatio.free": "自由",
        "imageCropRatio.a4p": "A4 竖",
        "imageCropRatio.a4l": "A4 横",
        "imageCropZoom.label": "预览缩放",
        "imageCropSaveBtn": "保存截取 PNG",
        // Image convert
        "image-panel-convert.h3": "格式转换",
        "imageConvertScope.label": "处理范围",
        "imageConvertScope.selected": "当前选中",
        "imageConvertScope.all": "全部图片",
        "imageConvertFormat.label": "目标格式",
        "imageConvertBtn": "执行格式转换",
        // Image compress
        "image-panel-compress.h3": "大小压缩",
        "imageCompressScope.label": "处理范围",
        "imageCompressScope.selected": "当前选中",
        "imageCompressScope.all": "全部图片",
        "imageCompressQuality.label": "质量 (1-100)",
        "imageCompressMaxSide.label": "最长边限制 (px，可留空)",
        "imageCompressMaxSide.placeholder": "不缩放",
        "imageCompressTargetKb.label": "压缩到小于 (KB，可留空)",
        "imageCompressTargetKb.placeholder": "例如 500",
        "imageCompressBestQuality": "在目标大小内保持最好质量",
        "imageCompressBtn": "执行压缩",
        // Log
        "log.title": "运行日志",
        "clearLogBtn": "清空",
        "log.waiting": "等待操作...",
        // Breadcrumb
        "breadcrumb.root": "根目录",
        // Alerts
        "alert.selectDir": "请先选择一个目录",
        "alert.selectPdf": "请先在左侧选择一个 PDF 文件",
        "alert.selectImage": "请先在左侧选择一个图片文件",
        "alert.validPage": "请输入有效页码",
        "alert.validCount": "请输入有效页数",
        "alert.validRange": "请输入有效的起止页码",
        "alert.validSize": "请输入有效的尺寸值",
        "alert.confirmClean": "确定要执行清理操作吗？此操作不可撤销。",
        "alert.confirmShutdown": "确定要关闭服务吗？关闭后需要手动重启。",
        "alert.cropSelect": "请先框选截取区域",
        "alert.cropLoading": "图片还在加载，请稍后再保存",
    },
    en: {
        "modePill.title": "Click to toggle PDF / Image mode",
        "shutdownBtn": "Shutdown",
        "shutdownBtn.title": "Shutdown server",
        "sidebar.title": "File Browser",
        "viewToggleBtn.title": "Toggle card view",
        "rootBtn.title": "Go to root directory",
        "openFolderBtn.title": "Open current directory in file manager",
        "scanBtn": "Scan PDF / ZIP",
        "refreshBtn": "Refresh",
        "fileTree.loading": "Loading...",
        "selectionInfo": "Select a directory or file on the left",
        "selectionInfo.dir": "Directory",
        "selectionInfo.pdf": "PDF File",
        "selectionInfo.zip": "ZIP File",
        "selectionInfo.image": "Image File",
        "selectionInfo.other": "File",
        "selectionInfo.selected": "Selected: ",
        "tab.resize": "Resize",
        "tab.delete": "Delete",
        "tab.extract": "Extract",
        "tab.metadata": "Metadata",
        "tab.zip2pdf": "ZIP → PDF",
        "tab.clean": "Clean",
        "pdfPreviewName": "No PDF selected",
        "pdfPreviewName.selected": "Selected PDF",
        "previewPlaceholder": "Select a PDF file on the left to preview",
        "preview.loading": "Loading...",
        "preview.loadError": "Preview failed:",
        "preview.pages": "pages",
        "metadata.loading": "Reading metadata...",
        "metadata.readError": "Metadata read failed:",
        "metadata.saving": "Saving...",
        "metadata.saved": "Metadata saved",
        "metadata.saveFailed": "Metadata save failed",
        "metadata.pages": "pages",
        "panel-resize.h3": "Page Resize",
        "resizeWidth.label": "Target Width (mm)",
        "resizeHeight.label": "Target Height (mm)",
        "resizeStrip.label": "Strip mode (fixed width, auto height)",
        "resizeBtn": "Resize",
        "panel-delete.h3": "Page Delete",
        "deleteMode.label": "Delete Mode",
        "deleteMode.single": "Single",
        "deleteMode.range": "First/Last N",
        "deleteMode.range-se": "Range",
        "deleteCount.label": "Page / Count",
        "deleteStart.label": "Start Page",
        "deleteEnd.label": "End Page",
        "deleteBack.label": "Direction",
        "deleteBack.front": "Front",
        "deleteBack.back": "Back",
        "deleteBtn": "Delete",
        "panel-extract.h3": "Page Extract",
        "extractMode.label": "Extract Mode",
        "extractMode.png": "→ PNG",
        "extractMode.pdf": "→ PDF",
        "extractDpi.label": "DPI Mode",
        "extractDpi.bw": "B&W",
        "extractDpi.color": "Color",
        "extractPage.label": "Page",
        "extractStart.label": "Start Page",
        "extractEnd.label": "End Page",
        "extractBtn": "Extract",
        "panel-metadata.h3": "Metadata",
        "metadataPlaceholder": "Select a PDF file on the left",
        "metaTitle.label": "Title",
        "metaAuthor.label": "Author",
        "metaSubject.label": "Subject",
        "metaKeywords.label": "Keywords",
        "metaCreator.label": "Creator",
        "metaProducer.label": "Producer",
        "metadataSaveBtn": "Save Metadata",
        "metadataReloadBtn": "Reload",
        "panel-zip2pdf.h3": "ZIP → PDF",
        "zipDpi.label": "DPI Mode",
        "zipDpi.bw": "B&W",
        "zipDpi.color": "Color",
        "zip2pdfBtn": "Convert",
        "panel-clean.h3": "Clean",
        "cleanType.label": "Clean Type",
        "cleanType.x_backup": "Resize",
        "cleanType.y_backup": "Page Ops",
        "cleanType.zip": "ZIP",
        "cleanType.all": "All",
        "cleanBtn": "Clean",
        "tab.image.resize": "Resize",
        "tab.image.merge": "Merge",
        "tab.image.crop": "Crop",
        "tab.image.convert": "Convert",
        "tab.image.compress": "Compress",
        "imagePreviewName": "No image selected",
        "imagePreviewEmpty": "Select an image file on the left",
        "imageCropPlaceholder": "Select an image to start cropping",
        "image-panel-resize.h3": "Image Resize",
        "imageResizeMode.label": "Resize By",
        "imageResizeMode.pixel": "Pixels",
        "imageResizeMode.percent": "Percentage",
        "imageResizeWidthLabel": "Width (px)",
        "imageResizeWidthLabel.percent": "Width (%)",
        "imageResizeHeightLabel": "Height (px)",
        "imageResizeHeightLabel.percent": "Height (%)",
        "imageResizeKeepRatio": "Keep ratio",
        "imageResizeNoEnlarge": "Don't enlarge",
        "imageResizeSummary.size": "Output Size",
        "imageResizeSummary.ratio": "Output Ratio",
        "imageResizeBtn": "Save Resized Image",
        "imageResizeResetBtn": "Reset",
        "image-panel-merge.h3": "Image Merge",
        "imageMergeMode.label": "Merge Mode",
        "imageMergeMode.grid": "Grid",
        "imageMergeMode.vertical": "Vertical",
        "imageMergeMode.horizontal": "Horizontal",
        "imageMergeBorder": "Add border / spacing",
        "imageMergeBtn": "Merge Images in Directory",
        "image-panel-crop.h3": "Image Crop",
        "imageCropRatio.label": "Crop Ratio",
        "imageCropRatio.free": "Free",
        "imageCropRatio.a4p": "A4 Portrait",
        "imageCropRatio.a4l": "A4 Landscape",
        "imageCropZoom.label": "Preview Zoom",
        "imageCropSaveBtn": "Save Crop as PNG",
        "image-panel-convert.h3": "Format Convert",
        "imageConvertScope.label": "Scope",
        "imageConvertScope.selected": "Selected",
        "imageConvertScope.all": "All Images",
        "imageConvertFormat.label": "Target Format",
        "imageConvertBtn": "Convert",
        "image-panel-compress.h3": "Image Compress",
        "imageCompressScope.label": "Scope",
        "imageCompressScope.selected": "Selected",
        "imageCompressScope.all": "All Images",
        "imageCompressQuality.label": "Quality (1-100)",
        "imageCompressMaxSide.label": "Max side (px, optional)",
        "imageCompressMaxSide.placeholder": "No resize",
        "imageCompressTargetKb.label": "Target size (KB, optional)",
        "imageCompressTargetKb.placeholder": "e.g. 500",
        "imageCompressBestQuality": "Best quality within target size",
        "imageCompressBtn": "Compress",
        "log.title": "Log",
        "clearLogBtn": "Clear",
        "log.waiting": "Waiting...",
        "breadcrumb.root": "Root",
        "alert.selectDir": "Please select a directory first",
        "alert.selectPdf": "Please select a PDF file on the left",
        "alert.selectImage": "Please select an image file on the left",
        "alert.validPage": "Please enter a valid page number",
        "alert.validCount": "Please enter a valid page count",
        "alert.validRange": "Please enter a valid page range",
        "alert.validSize": "Please enter valid size values",
        "alert.confirmClean": "Are you sure? This action cannot be undone.",
        "alert.confirmShutdown": "Are you sure you want to shut down the server?",
        "alert.cropSelect": "Please select a crop area first",
        "alert.cropLoading": "Image is still loading, please wait",
    }
};

function t(key) {
    return (T[currentLang] && T[currentLang][key]) || T.zh[key] || key;
}

function applyTranslations() {
    var lang = T[currentLang] || T.zh;
    document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";

    // data-i18n → textContent
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
        var key = el.dataset.i18n;
        if (lang[key] !== undefined) el.textContent = lang[key];
    });

    // data-i18n-title → title attribute
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
        var key = el.dataset.i18nTitle;
        if (lang[key] !== undefined) el.title = lang[key];
    });

    // data-i18n-placeholder → placeholder attribute
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
        var key = el.dataset.i18nPlaceholder;
        if (lang[key] !== undefined) el.placeholder = lang[key];
    });

    // Update lang toggle visual state
    var langToggle = document.getElementById("langToggle");
    if (langToggle) langToggle.dataset.active = currentLang;

    // Re-render JS-generated dynamic content
    if (typeof updateSelectionInfo === "function") updateSelectionInfo();
    if (typeof updateBreadcrumb === "function" && currentPath) updateBreadcrumb(currentPath);

    // Update preview placeholder texts (may have been overwritten by JS)
    var previewPh = document.querySelector("#previewPlaceholder p");
    if (previewPh && lang["previewPlaceholder"]) previewPh.textContent = lang["previewPlaceholder"];
    var metaPh = document.querySelector("#metadataPlaceholder p");
    if (metaPh && lang["metadataPlaceholder"]) metaPh.textContent = lang["metadataPlaceholder"];
    var imgEmpty = document.querySelector("#imagePreviewEmpty p");
    if (imgEmpty && lang["imagePreviewEmpty"]) imgEmpty.textContent = lang["imagePreviewEmpty"];
    var cropPh = document.querySelector("#imageCropPlaceholder p");
    if (cropPh && lang["imageCropPlaceholder"]) cropPh.textContent = lang["imageCropPlaceholder"];
}

function switchLanguage() {
    currentLang = currentLang === "zh" ? "en" : "zh";
    localStorage.setItem("pixelforge_lang", currentLang);
    applyTranslations();
}
