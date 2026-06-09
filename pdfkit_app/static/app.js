// =====================================================
// Global Error Handling
// =====================================================
window.onerror = function (msg, url, line, col, error) {
    console.error("[JS Error]", msg, "at", url + ":" + line + ":" + col, error);
    const el = document.getElementById("logOutput");
    if (el) {
        const div = document.createElement("div");
        div.className = "log-line log-line-error";
        div.innerHTML = '<span class="log-icon">!</span><span class="log-message">[JS Error] ' + msg + ' (line ' + line + ')</span>';
        el.appendChild(div);
    }
};
window.addEventListener("unhandledrejection", function (e) {
    console.error("[Unhandled Rejection]", e.reason);
});

// =====================================================
// State
// =====================================================
let currentPath = "";
let selectedPath = "";
let selectedType = ""; // "dir", "pdf", "zip", "image", "other"
let isRunning = false;
let cropState = {
    loadedPath: "",
    box: null,
    drag: null,
    naturalWidth: 0,
    naturalHeight: 0,
    baseWidth: 0,
    zoom: 1,
};
let imageCropState = {
    loadedPath: "",
    box: null,
    drag: null,
    naturalWidth: 0,
    naturalHeight: 0,
    baseWidth: 0,
    zoom: 1,
};
let imageResizeOriginalWidth = 0;
let imageResizeOriginalHeight = 0;
let imageResizeLockRatio = false;
let viewMode = "list";
let lastBrowseData = null;
let rootPath = "";

// =====================================================
// Helpers
// =====================================================

function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function classifyLogLine(msg) {
    const text = String(msg).trim();
    if (!text) return { type: "blank", icon: "" };
    if (/^=+$/.test(text)) return { type: "divider", icon: "" };
    if (text.includes("报告") || text.includes("文件总数") || text.includes("成功转换") ||
        text.includes("成功处理") || text.includes("处理失败") || text.includes("安全跳过")) {
        return { type: "summary", icon: "#" };
    }
    if (text.includes("[错误]") || text.includes("转换失败") || text.includes("删除失败") ||
        text.includes("缩放失败") || text.includes("提取失败") || text.includes("无效") || text.includes("超时")) {
        return { type: "error", icon: "!" };
    }
    if (text.includes("[跳过]") || text.includes("跳过") || text.includes("警告")) {
        return { type: "warning", icon: "!" };
    }
    if (text.includes("进度")) {
        return { type: "progress", icon: "%" };
    }
    if (text.includes("完成") || text.includes("成功") || text.includes("已保存") || text.includes("已打开")) {
        return { type: "success", icon: "OK" };
    }
    if (text.includes("开始") || text.includes("正在")) {
        return { type: "active", icon: ">" };
    }
    if (text.includes("扫描目录") || text.includes("指定文件") || text.includes("处理:") || text.includes("输出 DPI")) {
        return { type: "path", icon: "@" };
    }
    return { type: "info", icon: "i" };
}

function createLogLine(msg) {
    const meta = classifyLogLine(msg);
    const line = document.createElement("div");
    line.className = `log-line log-line-${meta.type}`;

    if (meta.type !== "blank" && meta.type !== "divider") {
        const icon = document.createElement("span");
        icon.className = "log-icon";
        icon.textContent = meta.icon;
        line.appendChild(icon);
    }

    const message = document.createElement("span");
    message.className = "log-message";
    message.textContent = meta.type === "divider" ? "" : msg;
    line.appendChild(message);
    return line;
}

function replaceLastLogLine(el, msg) {
    const replacement = createLogLine(msg);
    const last = el.lastElementChild;
    if (last) {
        el.replaceChild(replacement, last);
    } else {
        el.appendChild(replacement);
    }
}

function log(msg, replace = false) {
    const el = document.getElementById("logOutput");
    if (replace && el.dataset.replaceActive === "1") {
        replaceLastLogLine(el, msg);
    } else {
        const lines = String(msg).split("\n");
        for (const line of lines) {
            el.appendChild(createLogLine(line));
        }
    }
    el.dataset.replaceActive = replace ? "1" : "0";
    el.scrollTop = el.scrollHeight;
}

function clearLog() {
    const el = document.getElementById("logOutput");
    el.replaceChildren(createLogLine("等待操作..."));
    el.dataset.replaceActive = "0";
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizePath(path) {
    const value = String(path || "");
    if (value === "/") return "/";
    return value.replace(/\/+$/, "");
}

function isRootPath(path) {
    return normalizePath(path) === normalizePath(rootPath);
}

function setButtonsDisabled(disabled) {
    isRunning = disabled;
    document.querySelectorAll(".btn-primary, .btn-danger").forEach((btn) => {
        btn.disabled = disabled;
    });
}

async function api(endpoint, data) {
    const resp = await fetch("/api/" + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return resp.json();
}

async function apiStream(endpoint, data, onLine) {
    let resp;
    try {
        resp = await fetch("/api/" + endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    } catch (e) {
        onLine(`[错误] 请求失败: ${e.message}`);
        return false;
    }

    if (!resp.ok) {
        let message = resp.statusText;
        try {
            const err = await resp.json();
            message = err.error || message;
        } catch (_) {}
        onLine(`[错误] ${message}`);
        return false;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let success = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
                const evt = JSON.parse(line.slice(6));
                if (evt.done) {
                    success = evt.success;
                } else if (evt.line !== undefined) {
                    onLine(evt.line, Boolean(evt.replace));
                }
            } catch (_) {}
        }
    }

    return success;
}

function fileIcon(ext) {
    const icons = {
        ".pdf": "📄",
        ".zip": "📦",
        ".png": "🖼",
        ".jpg": "🖼",
        ".jpeg": "🖼",
        ".webp": "🖼",
        ".bmp": "🖼",
        ".tif": "🖼",
        ".tiff": "🖼",
    };
    return icons[ext] || "📎";
}

// =====================================================
// PDF Preview
// =====================================================

function switchToTab(tabName) {
    const pdfPage = document.getElementById("pdfPage");
    if (!pdfPage) return;

    pdfPage.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    pdfPage.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    const tabBtn = pdfPage.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add("active");
    const panel = pdfPage.querySelector("#panel-" + tabName);
    if (panel) panel.classList.add("active");

    document.querySelector(".content").classList.toggle("hide-log", tabName === "preview");
}

function switchMainPage(pageName) {
    document.querySelectorAll(".mode-opt").forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.page === pageName);
    });

    document.querySelectorAll(".tool-page").forEach((page) => {
        page.classList.toggle("active", page.id === `${pageName}Page`);
    });

    const subtitle = document.getElementById("subtitleText");
    if (subtitle) {
        subtitle.textContent = pageName === "pdf"
            ? "缩放 · 裁剪 · 提取 · 转换"
            : "拉伸 · 合并 · 截取 · 压缩";
    }

    const content = document.querySelector(".content");
    if (pageName === "image") {
        content.classList.remove("hide-log");
    } else {
        const activePdfTab = document.querySelector("#pdfPage .tab.active");
        content.classList.toggle("hide-log", activePdfTab && activePdfTab.dataset.tab === "preview");
    }
}

function switchImageTab(tabName) {
    const imagePage = document.getElementById("imagePage");
    if (!imagePage) return;

    imagePage.querySelectorAll(".tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.imageTab === tabName);
    });
    imagePage.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `image-panel-${tabName}`);
    });
}

async function showPdfPreview(filePath) {
    const placeholder = document.getElementById("previewPlaceholder");
    const container = document.getElementById("previewContainer");
    const frame = document.getElementById("previewFrame");
    const info = document.getElementById("previewInfo");

    placeholder.classList.remove("hidden");
    placeholder.innerHTML = "<p>加载中...</p>";
    container.classList.add("hidden");

    try {
        const resp = await fetch("/api/pdf-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: filePath }),
        });
        const data = await resp.json();

        if (data.error) {
            placeholder.innerHTML = `<p>${escapeHtml(data.error)}</p>`;
            return;
        }

        info.innerHTML = `
            <span class="info-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span class="info-label">${escapeHtml(data.name)}</span></span>
            <span class="info-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>页数 <span class="info-label">${data.pages}</span></span>
            <span class="info-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg><span class="info-label">${data.width_mm} x ${data.height_mm} mm</span></span>
            <span class="info-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span class="info-label">${formatSize(data.size)}</span></span>
        `;

        frame.src = "/api/pdf-file?path=" + encodeURIComponent(filePath);
        placeholder.classList.add("hidden");
        container.classList.remove("hidden");
    } catch (e) {
        placeholder.innerHTML = `<p>预览加载失败: ${escapeHtml(e.message)}</p>`;
    }
}

function clearPdfPreview() {
    const placeholder = document.getElementById("previewPlaceholder");
    const container = document.getElementById("previewContainer");
    const frame = document.getElementById("previewFrame");

    placeholder.classList.remove("hidden");
    placeholder.innerHTML = "<p>选择左侧目录中的 PDF 文件即可预览</p>";
    container.classList.add("hidden");
    frame.src = "";
}

// =====================================================
// Crop Tool
// =====================================================

function cropEls() {
    return {
        placeholder: document.getElementById("cropPlaceholder"),
        wrap: document.getElementById("cropStageWrap"),
        stage: document.getElementById("cropStage"),
        img: document.getElementById("cropImage"),
        box: document.getElementById("cropBox"),
        zoom: document.getElementById("cropZoom"),
        zoomLabel: document.getElementById("cropZoomLabel"),
    };
}

function getCropRatio() {
    return getRatioFromSelect("cropRatio");
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getRatioFromSelect(id) {
    const value = document.getElementById(id).value;
    const ratios = {
        "1:1": 1,
        a4p: 210 / 297,
        a4l: 297 / 210,
        "16:9": 16 / 9,
        "4:3": 4 / 3,
    };
    return ratios[value] || null;
}

function getCropStageSize() {
    const { img } = cropEls();
    return { width: img.clientWidth, height: img.clientHeight };
}

function applyCropZoom(nextZoom, keepSelection = true) {
    const { stage, img, zoom, zoomLabel } = cropEls();
    const crop = keepSelection ? getNormalizedCropBox() : null;
    const clamped = clamp(nextZoom, 0.5, 3);
    cropState.zoom = clamped;
    zoom.value = String(Math.round(clamped * 100));
    zoomLabel.textContent = `${Math.round(clamped * 100)}%`;

    if (cropState.baseWidth > 0) {
        const displayWidth = Math.round(cropState.baseWidth * clamped);
        img.style.width = `${displayWidth}px`;
        stage.style.width = `${displayWidth}px`;
    }

    requestAnimationFrame(() => {
        if (crop) {
            restoreCropBoxFromNormalized(crop);
        } else if (cropState.loadedPath) {
            initDefaultCropBox();
        }
    });
}

function setCropZoomPercent(percent) {
    applyCropZoom(percent / 100, true);
}

function recalcCropBaseWidth() {
    if (!cropState.loadedPath || cropState.naturalWidth <= 0) return;
    const { wrap } = cropEls();
    cropState.baseWidth = Math.min(cropState.naturalWidth, Math.max(320, wrap.clientWidth - 34));
    applyCropZoom(cropState.zoom, true);
}

function constrainCropRect(rect) {
    const { width, height } = getCropStageSize();
    const minSize = 12;
    let w = clamp(rect.w, minSize, width);
    let h = clamp(rect.h, minSize, height);
    let x = clamp(rect.x, 0, width - w);
    let y = clamp(rect.y, 0, height - h);
    return { x, y, w, h };
}

function setCropBox(rect) {
    const { box } = cropEls();
    const next = constrainCropRect(rect);
    cropState.box = next;
    box.style.left = `${next.x}px`;
    box.style.top = `${next.y}px`;
    box.style.width = `${next.w}px`;
    box.style.height = `${next.h}px`;
    box.classList.remove("hidden");
}

function rectFromDrag(startX, startY, currentX, currentY) {
    const ratio = getCropRatio();
    let dx = currentX - startX;
    let dy = currentY - startY;
    let w = Math.abs(dx);
    let h = Math.abs(dy);

    if (ratio && w > 0 && h > 0) {
        if (w / h > ratio) {
            w = h * ratio;
        } else {
            h = w / ratio;
        }
    }

    return {
        x: dx < 0 ? startX - w : startX,
        y: dy < 0 ? startY - h : startY,
        w,
        h,
    };
}

function rectFromResize(handle, startBox, point) {
    const ratio = getCropRatio();
    const minSize = 12;
    const left = startBox.x;
    const top = startBox.y;
    const right = startBox.x + startBox.w;
    const bottom = startBox.y + startBox.h;
    const affectsWest = handle.includes("w");
    const affectsEast = handle.includes("e");
    const affectsNorth = handle.includes("n");
    const affectsSouth = handle.includes("s");

    let anchorX = affectsWest ? right : left;
    let anchorY = affectsNorth ? bottom : top;
    let movingX = affectsWest || affectsEast ? point.x : (left + right) / 2;
    let movingY = affectsNorth || affectsSouth ? point.y : (top + bottom) / 2;
    let w = affectsWest || affectsEast ? Math.max(minSize, Math.abs(movingX - anchorX)) : startBox.w;
    let h = affectsNorth || affectsSouth ? Math.max(minSize, Math.abs(movingY - anchorY)) : startBox.h;

    if (ratio) {
        if ((affectsWest || affectsEast) && !(affectsNorth || affectsSouth)) {
            h = w / ratio;
        } else if ((affectsNorth || affectsSouth) && !(affectsWest || affectsEast)) {
            w = h * ratio;
        } else if (w / h > ratio) {
            w = h * ratio;
        } else {
            h = w / ratio;
        }
    }

    if (!affectsWest && !affectsEast) {
        anchorX = (left + right) / 2;
    }
    if (!affectsNorth && !affectsSouth) {
        anchorY = (top + bottom) / 2;
    }

    let x;
    if (affectsWest) {
        x = anchorX - w;
    } else if (affectsEast) {
        x = anchorX;
    } else {
        x = anchorX - w / 2;
    }

    let y;
    if (affectsNorth) {
        y = anchorY - h;
    } else if (affectsSouth) {
        y = anchorY;
    } else {
        y = anchorY - h / 2;
    }

    return { x, y, w, h };
}

function initDefaultCropBox() {
    const { width, height } = getCropStageSize();
    const ratio = getCropRatio();
    let w = width * 0.62;
    let h = height * 0.62;

    if (ratio) {
        if (w / h > ratio) {
            w = h * ratio;
        } else {
            h = w / ratio;
        }
    }

    setCropBox({
        x: (width - w) / 2,
        y: (height - h) / 2,
        w,
        h,
    });
}

function applyCropRatioToCurrentBox() {
    if (!cropState.loadedPath) return;
    if (!cropState.box) {
        initDefaultCropBox();
        return;
    }

    const ratio = getCropRatio();
    if (!ratio) return;

    const { width, height } = getCropStageSize();
    const centerX = cropState.box.x + cropState.box.w / 2;
    const centerY = cropState.box.y + cropState.box.h / 2;
    let w = cropState.box.w;
    let h = cropState.box.h;

    if (w / h > ratio) {
        w = h * ratio;
    } else {
        h = w / ratio;
    }

    if (w > width) {
        w = width;
        h = w / ratio;
    }
    if (h > height) {
        h = height;
        w = h * ratio;
    }

    setCropBox({
        x: centerX - w / 2,
        y: centerY - h / 2,
        w,
        h,
    });
}

function getStagePoint(event) {
    const { stage } = cropEls();
    const rect = stage.getBoundingClientRect();
    return {
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
    };
}

async function loadCropPage() {
    if (selectedType !== "pdf") return alert("请先在左侧选择一个 PDF 文件");

    const page = parseInt(document.getElementById("cropPage").value);
    if (!page || page < 1) return alert("请输入有效页码");

    const { placeholder, wrap, img, box } = cropEls();
    placeholder.classList.remove("hidden");
    placeholder.innerHTML = "<p>页面加载中...</p>";
    wrap.classList.add("hidden");
    box.classList.add("hidden");
    cropState.loadedPath = "";
    cropState.box = null;

    img.onload = () => {
        cropState.loadedPath = selectedPath;
        cropState.naturalWidth = img.naturalWidth;
        cropState.naturalHeight = img.naturalHeight;
        placeholder.classList.add("hidden");
        wrap.classList.remove("hidden");
        cropState.baseWidth = Math.min(img.naturalWidth, Math.max(320, wrap.clientWidth - 34));
        applyCropZoom(cropState.zoom, false);
    };
    img.onerror = () => {
        placeholder.innerHTML = "<p>页面加载失败</p>";
    };
    img.src = `/api/page-image?path=${encodeURIComponent(selectedPath)}&page=${page}&dpi=140&v=${Date.now()}`;
}

function getNormalizedCropBox() {
    if (!cropState.box) return null;
    const { width, height } = getCropStageSize();
    return {
        x: cropState.box.x / width,
        y: cropState.box.y / height,
        width: cropState.box.w / width,
        height: cropState.box.h / height,
    };
}

function restoreCropBoxFromNormalized(crop) {
    const { width, height } = getCropStageSize();
    setCropBox({
        x: crop.x * width,
        y: crop.y * height,
        w: crop.width * width,
        h: crop.height * height,
    });
}

async function doCropSave() {
    if (isRunning) return;
    if (selectedType !== "pdf") return alert("请先在左侧选择一个 PDF 文件");
    if (!cropState.loadedPath || cropState.loadedPath !== selectedPath) {
        return alert("请先加载当前 PDF 的页面");
    }

    const crop = getNormalizedCropBox();
    if (!crop || crop.width <= 0 || crop.height <= 0) return alert("请先框选截取区域");

    const page = parseInt(document.getElementById("cropPage").value);
    const dpi = parseInt(document.getElementById("cropDpi").value);
    if (!page || page < 1) return alert("请输入有效页码");
    if (!dpi || dpi < 72 || dpi > 600) return alert("请输入 72 到 600 之间的 DPI");

    setButtonsDisabled(true);
    log("\n=== 开始框选截取 ===\n");

    const success = await apiStream("crop-png", {
        folder: currentPath,
        file: selectedPath,
        page,
        dpi,
        crop,
    }, (line, replace) => log(line, replace));

    log(success ? "\n=== 截取完成 ===\n" : "\n=== 截取失败 ===\n");
    setButtonsDisabled(false);
}

function bindCropStageEvents() {
    const { stage, box } = cropEls();

    stage.addEventListener("mousedown", (event) => {
        if (!cropState.loadedPath) return;
        event.preventDefault();
        const point = getStagePoint(event);
        const handle = event.target.dataset.handle;

        if (handle && cropState.box) {
            cropState.drag = {
                mode: "resize",
                handle,
                box: { ...cropState.box },
            };
        } else if (event.target === box && cropState.box) {
            cropState.drag = {
                mode: "move",
                startX: point.x,
                startY: point.y,
                box: { ...cropState.box },
            };
        } else {
            cropState.drag = {
                mode: "draw",
                startX: point.x,
                startY: point.y,
            };
            setCropBox({ x: point.x, y: point.y, w: 12, h: 12 });
        }
    });

    window.addEventListener("mousemove", (event) => {
        if (!cropState.drag) return;
        const point = getStagePoint(event);

        if (cropState.drag.mode === "move") {
            const dx = point.x - cropState.drag.startX;
            const dy = point.y - cropState.drag.startY;
            setCropBox({
                x: cropState.drag.box.x + dx,
                y: cropState.drag.box.y + dy,
                w: cropState.drag.box.w,
                h: cropState.drag.box.h,
            });
        } else if (cropState.drag.mode === "resize") {
            setCropBox(rectFromResize(cropState.drag.handle, cropState.drag.box, point));
        } else {
            setCropBox(rectFromDrag(
                cropState.drag.startX,
                cropState.drag.startY,
                point.x,
                point.y,
            ));
        }
    });

    window.addEventListener("mouseup", () => {
        cropState.drag = null;
    });

    window.addEventListener("resize", () => {
        if (cropState.loadedPath) {
            recalcCropBaseWidth();
        }
    });
}

function clearCropTool() {
    const { placeholder, wrap, img, box } = cropEls();
    placeholder.classList.remove("hidden");
    placeholder.innerHTML = "<p>选择一个 PDF 文件后加载页面并拖拽框选</p>";
    wrap.classList.add("hidden");
    img.removeAttribute("src");
    box.classList.add("hidden");
    cropState.loadedPath = "";
    cropState.box = null;
    cropState.drag = null;
    cropState.naturalWidth = 0;
    cropState.naturalHeight = 0;
    cropState.baseWidth = 0;
    cropState.zoom = 1;
    img.style.width = "";
    document.getElementById("cropZoom").value = "100";
    document.getElementById("cropZoomLabel").textContent = "100%";
}

// =====================================================
// Image Tool
// =====================================================

function isSelectedImage() {
    return selectedType === "image";
}

function imageCropEls() {
    return {
        placeholder: document.getElementById("imageCropPlaceholder"),
        wrap: document.getElementById("imageCropStageWrap"),
        stage: document.getElementById("imageCropStage"),
        img: document.getElementById("imageCropImage"),
        box: document.getElementById("imageCropBox"),
        zoom: document.getElementById("imageCropZoom"),
        zoomLabel: document.getElementById("imageCropZoomLabel"),
    };
}

function getImageCropStageSize() {
    const { img } = imageCropEls();
    return { width: img.clientWidth, height: img.clientHeight };
}

function constrainImageCropRect(rect) {
    const { width, height } = getImageCropStageSize();
    const minSize = 12;
    const w = clamp(rect.w, minSize, width);
    const h = clamp(rect.h, minSize, height);
    return {
        x: clamp(rect.x, 0, width - w),
        y: clamp(rect.y, 0, height - h),
        w,
        h,
    };
}

function setImageCropBox(rect) {
    const { box } = imageCropEls();
    const next = constrainImageCropRect(rect);
    imageCropState.box = next;
    box.style.left = `${next.x}px`;
    box.style.top = `${next.y}px`;
    box.style.width = `${next.w}px`;
    box.style.height = `${next.h}px`;
    box.classList.remove("hidden");
}

function imageRectFromDrag(startX, startY, currentX, currentY) {
    const ratio = getRatioFromSelect("imageCropRatio");
    let dx = currentX - startX;
    let dy = currentY - startY;
    let w = Math.abs(dx);
    let h = Math.abs(dy);
    if (ratio && w > 0 && h > 0) {
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
    }
    return {
        x: dx < 0 ? startX - w : startX,
        y: dy < 0 ? startY - h : startY,
        w,
        h,
    };
}

function imageRectFromResize(handle, startBox, point) {
    const ratio = getRatioFromSelect("imageCropRatio");
    const minSize = 12;
    const left = startBox.x;
    const top = startBox.y;
    const right = startBox.x + startBox.w;
    const bottom = startBox.y + startBox.h;
    const west = handle.includes("w");
    const east = handle.includes("e");
    const north = handle.includes("n");
    const south = handle.includes("s");
    let anchorX = west ? right : left;
    let anchorY = north ? bottom : top;
    let w = west || east ? Math.max(minSize, Math.abs(point.x - anchorX)) : startBox.w;
    let h = north || south ? Math.max(minSize, Math.abs(point.y - anchorY)) : startBox.h;

    if (ratio) {
        if ((west || east) && !(north || south)) h = w / ratio;
        else if ((north || south) && !(west || east)) w = h * ratio;
        else if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
    }

    if (!west && !east) anchorX = (left + right) / 2;
    if (!north && !south) anchorY = (top + bottom) / 2;
    return {
        x: west ? anchorX - w : east ? anchorX : anchorX - w / 2,
        y: north ? anchorY - h : south ? anchorY : anchorY - h / 2,
        w,
        h,
    };
}

function getImageStagePoint(event) {
    const { stage } = imageCropEls();
    const rect = stage.getBoundingClientRect();
    return {
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
    };
}

function initDefaultImageCropBox() {
    const { width, height } = getImageCropStageSize();
    const ratio = getRatioFromSelect("imageCropRatio");
    let w = width * 0.62;
    let h = height * 0.62;
    if (ratio) {
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
    }
    setImageCropBox({ x: (width - w) / 2, y: (height - h) / 2, w, h });
}

function getNormalizedImageCropBox() {
    if (!imageCropState.box) return null;
    const { width, height } = getImageCropStageSize();
    return {
        x: imageCropState.box.x / width,
        y: imageCropState.box.y / height,
        width: imageCropState.box.w / width,
        height: imageCropState.box.h / height,
    };
}

function restoreImageCropBoxFromNormalized(crop) {
    const { width, height } = getImageCropStageSize();
    setImageCropBox({
        x: crop.x * width,
        y: crop.y * height,
        w: crop.width * width,
        h: crop.height * height,
    });
}

function applyImageCropZoom(nextZoom, keepSelection = true) {
    const { stage, img, zoom, zoomLabel } = imageCropEls();
    const crop = keepSelection ? getNormalizedImageCropBox() : null;
    const clamped = clamp(nextZoom, 0.5, 3);
    imageCropState.zoom = clamped;
    zoom.value = String(Math.round(clamped * 100));
    zoomLabel.textContent = `${Math.round(clamped * 100)}%`;
    if (imageCropState.baseWidth > 0) {
        const displayWidth = Math.round(imageCropState.baseWidth * clamped);
        img.style.width = `${displayWidth}px`;
        stage.style.width = `${displayWidth}px`;
    }
    requestAnimationFrame(() => {
        if (crop) restoreImageCropBoxFromNormalized(crop);
        else if (imageCropState.loadedPath) initDefaultImageCropBox();
    });
}

function setImageCropZoomPercent(percent) {
    applyImageCropZoom(percent / 100, true);
}

async function loadImageCrop() {
    if (!isSelectedImage()) return alert("请先在左侧选择一个图片文件");
    const { placeholder, wrap, img, box } = imageCropEls();
    placeholder.classList.remove("hidden");
    placeholder.innerHTML = "<p>图片加载中...</p>";
    wrap.classList.add("hidden");
    box.classList.add("hidden");
    imageCropState.loadedPath = "";
    imageCropState.box = null;
    img.onload = () => {
        imageCropState.loadedPath = selectedPath;
        imageCropState.naturalWidth = img.naturalWidth;
        imageCropState.naturalHeight = img.naturalHeight;
        placeholder.classList.add("hidden");
        wrap.classList.remove("hidden");
        imageCropState.baseWidth = Math.min(img.naturalWidth, Math.max(320, wrap.clientWidth - 34));
        applyImageCropZoom(imageCropState.zoom, false);
    };
    img.onerror = () => {
        placeholder.innerHTML = "<p>图片加载失败</p>";
    };
    img.src = `/api/image-file?path=${encodeURIComponent(selectedPath)}&v=${Date.now()}`;
}

async function saveImageCrop() {
    if (isRunning) return;
    if (!isSelectedImage()) return alert("请先在左侧选择一个图片文件");
    if (!imageCropState.loadedPath || imageCropState.loadedPath !== selectedPath) {
        return alert("请先加载当前图片");
    }
    const crop = getNormalizedImageCropBox();
    if (!crop) return alert("请先框选截取区域");
    setButtonsDisabled(true);
    log("\n=== 开始图片截取 ===\n");
    const success = await apiStream("image-crop", {
        folder: currentPath,
        file: selectedPath,
        crop,
    }, (line, replace) => log(line, replace));
    log(success ? "\n=== 图片截取完成 ===\n" : "\n=== 图片截取失败 ===\n");
    setButtonsDisabled(false);
}

function clearImageCropTool() {
    const { placeholder, wrap, img, box } = imageCropEls();
    placeholder.classList.remove("hidden");
    placeholder.innerHTML = "<p>选择一个图片文件后加载并拖拽框选</p>";
    wrap.classList.add("hidden");
    img.removeAttribute("src");
    img.style.width = "";
    box.classList.add("hidden");
    imageCropState = {
        loadedPath: "",
        box: null,
        drag: null,
        naturalWidth: 0,
        naturalHeight: 0,
        baseWidth: 0,
        zoom: 1,
    };
    document.getElementById("imageCropZoom").value = "100";
    document.getElementById("imageCropZoomLabel").textContent = "100%";
}

function bindImageCropEvents() {
    const { stage, box } = imageCropEls();
    stage.addEventListener("mousedown", (event) => {
        if (!imageCropState.loadedPath) return;
        event.preventDefault();
        const point = getImageStagePoint(event);
        const handle = event.target.dataset.handle;
        if (handle && imageCropState.box) {
            imageCropState.drag = { mode: "resize", handle, box: { ...imageCropState.box } };
        } else if (event.target === box && imageCropState.box) {
            imageCropState.drag = {
                mode: "move",
                startX: point.x,
                startY: point.y,
                box: { ...imageCropState.box },
            };
        } else {
            imageCropState.drag = { mode: "draw", startX: point.x, startY: point.y };
            setImageCropBox({ x: point.x, y: point.y, w: 12, h: 12 });
        }
    });
    window.addEventListener("mousemove", (event) => {
        if (!imageCropState.drag) return;
        const point = getImageStagePoint(event);
        if (imageCropState.drag.mode === "move") {
            const dx = point.x - imageCropState.drag.startX;
            const dy = point.y - imageCropState.drag.startY;
            setImageCropBox({
                x: imageCropState.drag.box.x + dx,
                y: imageCropState.drag.box.y + dy,
                w: imageCropState.drag.box.w,
                h: imageCropState.drag.box.h,
            });
        } else if (imageCropState.drag.mode === "resize") {
            setImageCropBox(imageRectFromResize(imageCropState.drag.handle, imageCropState.drag.box, point));
        } else {
            setImageCropBox(imageRectFromDrag(imageCropState.drag.startX, imageCropState.drag.startY, point.x, point.y));
        }
    });
    window.addEventListener("mouseup", () => {
        imageCropState.drag = null;
    });
}

function loadImageInfoForResize() {
    if (!isSelectedImage()) {
        clearImageResizeInfo();
        return;
    }
    const img = new Image();
    img.onload = () => {
        imageResizeOriginalWidth = img.naturalWidth;
        imageResizeOriginalHeight = img.naturalHeight;

        document.getElementById("imageResizeOrigW").textContent = img.naturalWidth;
        document.getElementById("imageResizeOrigH").textContent = img.naturalHeight;
        document.getElementById("imageResizePreview").src = img.src;
        document.getElementById("imageResizeCard").classList.remove("hidden");
        document.getElementById("imageResizeNoCard").classList.add("hidden");

        document.getElementById("imageResizeWidthPct").value = 100;
        document.getElementById("imageResizeHeightPct").value = 100;
        updateResizeCalcDisplay();
        applyResizePreset("free");
    };
    img.onerror = () => clearImageResizeInfo();
    img.src = `/api/image-file?path=${encodeURIComponent(selectedPath)}&v=${Date.now()}`;
}

function clearImageResizeInfo() {
    imageResizeOriginalWidth = 0;
    imageResizeOriginalHeight = 0;
    imageResizeLockRatio = false;
    document.getElementById("imageResizeCard").classList.add("hidden");
    document.getElementById("imageResizeNoCard").classList.remove("hidden");
    document.getElementById("imageResizePreview").removeAttribute("src");
    document.getElementById("imageResizeOrigW").textContent = "-";
    document.getElementById("imageResizeOrigH").textContent = "-";
    document.getElementById("imageResizeCalcW").textContent = "-";
    document.getElementById("imageResizeCalcH").textContent = "-";
    document.getElementById("imageResizeCalcRatio").textContent = "-";
    document.getElementById("imageResizeWidthPct").value = 100;
    document.getElementById("imageResizeHeightPct").value = 100;
    document.getElementById("imageResizeLockBtn").classList.remove("locked");
    applyResizePreset("free");
}

function formatOutputRatio(width, height) {
    if (!width || !height) return "-";
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const simplifiedW = Math.round(width / divisor);
    const simplifiedH = Math.round(height / divisor);
    const decimal = width / height;
    if (simplifiedW <= 100 && simplifiedH <= 100) {
        return `${simplifiedW}:${simplifiedH}`;
    }
    return decimal.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function updateResizeCalcDisplay() {
    const wPct = parseFloat(document.getElementById("imageResizeWidthPct").value) || 0;
    const hPct = parseFloat(document.getElementById("imageResizeHeightPct").value) || 0;
    if (imageResizeOriginalWidth > 0 && imageResizeOriginalHeight > 0) {
        const w = Math.round(imageResizeOriginalWidth * wPct / 100);
        const h = Math.round(imageResizeOriginalHeight * hPct / 100);
        document.getElementById("imageResizeCalcW").textContent = w;
        document.getElementById("imageResizeCalcH").textContent = h;
        document.getElementById("imageResizeCalcRatio").textContent = formatOutputRatio(w, h);
    } else {
        document.getElementById("imageResizeCalcW").textContent = "-";
        document.getElementById("imageResizeCalcH").textContent = "-";
        document.getElementById("imageResizeCalcRatio").textContent = "-";
    }
}

function applyResizePreset(preset) {
    const wInput = document.getElementById("imageResizeWidthPct");
    const hInput = document.getElementById("imageResizeHeightPct");

    document.querySelectorAll(".resize-preset").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.resizePreset === preset);
    });

    if (preset === "free") {
        updateResizeCalcDisplay();
        return;
    }

    const ratios = {
        "1:1": 1,
        "4:3": 4 / 3,
        "16:9": 16 / 9,
        "3:4": 3 / 4,
        "9:16": 9 / 16,
        "a4p": 210 / 297,
        "a4l": 297 / 210,
    };
    const targetRatio = ratios[preset];
    if (!targetRatio || imageResizeOriginalWidth <= 0 || imageResizeOriginalHeight <= 0) return;

    const origRatio = imageResizeOriginalWidth / imageResizeOriginalHeight;
    let wPct, hPct;
    if (targetRatio >= origRatio) {
        wPct = 100;
        hPct = Math.round(1000 * origRatio / targetRatio) / 10;
    } else {
        hPct = 100;
        wPct = Math.round(1000 * targetRatio / origRatio) / 10;
    }
    wInput.value = wPct;
    hInput.value = hPct;
    updateResizeCalcDisplay();
}

function toggleResizeLock() {
    imageResizeLockRatio = !imageResizeLockRatio;
    document.getElementById("imageResizeLockBtn").classList.toggle("locked", imageResizeLockRatio);
}

function applyResizeScale(scale) {
    const value = Math.max(1, Math.min(1000, parseFloat(scale) || 100));
    document.getElementById("imageResizeWidthPct").value = value;
    document.getElementById("imageResizeHeightPct").value = value;
    applyResizePreset("free");
    updateResizeCalcDisplay();
}

function resetImageResizeSettings() {
    imageResizeLockRatio = false;
    document.getElementById("imageResizeLockBtn").classList.remove("locked");
    applyResizeScale(100);
}

async function doImageResize() {
    if (!isSelectedImage()) return alert("请先在左侧选择一个图片文件");
    const wPct = parseFloat(document.getElementById("imageResizeWidthPct").value);
    const hPct = parseFloat(document.getElementById("imageResizeHeightPct").value);
    if (!wPct || !hPct || wPct <= 0 || hPct <= 0) return alert("请输入有效的百分比值");
    setButtonsDisabled(true);
    log("\n=== 开始图片拉伸 ===\n");
    const success = await apiStream("image-resize", {
        folder: currentPath,
        file: selectedPath,
        width_pct: wPct,
        height_pct: hPct,
    }, (line, replace) => log(line, replace));
    log(success ? "\n=== 图片拉伸完成 ===\n" : "\n=== 图片拉伸失败 ===\n");
    setButtonsDisabled(false);
    refreshDirectory();
}

async function doImageMerge() {
    setButtonsDisabled(true);
    log("\n=== 开始图片合并 ===\n");
    const success = await apiStream("image-merge", {
        folder: currentPath,
        mode: document.getElementById("imageMergeMode").value,
        border: document.getElementById("imageMergeBorder").checked,
    }, (line, replace) => log(line, replace));
    log(success ? "\n=== 图片合并完成 ===\n" : "\n=== 图片合并失败 ===\n");
    setButtonsDisabled(false);
    refreshDirectory();
}

async function doImageConvert() {
    const scope = document.getElementById("imageConvertScope").value;
    if (scope === "selected" && !isSelectedImage()) return alert("请先在左侧选择一个图片文件");
    setButtonsDisabled(true);
    log("\n=== 开始格式转换 ===\n");
    const success = await apiStream("image-convert", {
        folder: currentPath,
        file: selectedPath,
        scope,
        format: document.getElementById("imageConvertFormat").value,
    }, (line, replace) => log(line, replace));
    log(success ? "\n=== 格式转换完成 ===\n" : "\n=== 格式转换失败 ===\n");
    setButtonsDisabled(false);
    refreshDirectory();
}

async function doImageCompress() {
    const scope = document.getElementById("imageCompressScope").value;
    if (scope === "selected" && !isSelectedImage()) return alert("请先在左侧选择一个图片文件");
    const maxSideValue = document.getElementById("imageCompressMaxSide").value;
    setButtonsDisabled(true);
    log("\n=== 开始图片压缩 ===\n");
    const success = await apiStream("image-compress", {
        folder: currentPath,
        file: selectedPath,
        scope,
        quality: parseInt(document.getElementById("imageCompressQuality").value),
        max_side: maxSideValue ? parseInt(maxSideValue) : null,
    }, (line, replace) => log(line, replace));
    log(success ? "\n=== 图片压缩完成 ===\n" : "\n=== 图片压缩失败 ===\n");
    setButtonsDisabled(false);
    refreshDirectory();
}

// =====================================================
// Directory Browser
// =====================================================

async function navigateTo(path) {
    console.log("[Debug] navigateTo called with path:", path);
    const treeEl = document.getElementById("fileTree");
    treeEl.innerHTML = '<div class="loading">加载中...</div>';

    const data = await api("browse", { path });
    console.log("[Debug] browse API response:", data.error ? "ERROR: " + data.error : "OK, dirs=" + data.dirs.length + " files=" + data.files.length);
    if (data.error) {
        treeEl.innerHTML = `<div class="loading">${escapeHtml(data.error)}</div>`;
        return;
    }

    currentPath = data.path;
    selectedPath = "";
    selectedType = "";
    updateBreadcrumb(data.path);
    updateSelectionInfo();
    clearPdfPreview();
    clearCropTool();
    clearImageCropTool();
    clearImageResizeInfo();

    lastBrowseData = data;
    renderFileTree(data);
}

function renderFileTree(data) {
    console.log("[Debug] renderFileTree, viewMode:", viewMode, "dirs:", data.dirs.length, "files:", data.files.length);
    const treeEl = document.getElementById("fileTree");
    const imageExts = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"];

    treeEl.classList.toggle("card-view", viewMode === "card");

    let html = "";

    const parentPath = data.path.endsWith("/")
        ? data.path.slice(0, -1).split("/").slice(0, -1).join("/") || "/"
        : data.path.split("/").slice(0, -1).join("/") || "/";

    if (viewMode === "card") {
        // Parent directory
        if (!isRootPath(data.path) && data.path !== "/" && data.path.length > 1) {
            html += `<div class="card-item parent-dir" data-path="${escapeHtml(parentPath)}" data-type="dir">
                <div class="card-thumb"><span class="card-icon">⬆</span></div>
                <div class="card-info"><div class="card-name">..</div></div>
            </div>`;
        }

        // Directories (full-width rows)
        for (const d of data.dirs) {
            html += `<div class="card-item card-dir" data-path="${escapeHtml(d.path)}" data-type="dir">
                <div class="card-thumb"><span class="card-icon">📁</span></div>
                <div class="card-info"><div class="card-name">${escapeHtml(d.name)}</div></div>
            </div>`;
        }

        // Files as cards
        for (const f of data.files) {
            const ext = f.ext;
            const type = ext === ".pdf" ? "pdf" : ext === ".zip" ? "zip" : imageExts.includes(ext) ? "image" : "other";
            let thumbHtml;
            if (type === "pdf") {
                thumbHtml = `<div class="card-thumb ratio-a4"><img src="/api/page-image?path=${encodeURIComponent(f.path)}&page=1&dpi=72" alt=""></div>`;
            } else if (type === "image") {
                thumbHtml = `<div class="card-thumb ratio-auto"><img src="/api/image-file?path=${encodeURIComponent(f.path)}" alt=""></div>`;
            } else {
                const icon = fileIcon(ext);
                thumbHtml = `<div class="card-thumb ratio-square"><span class="card-icon">${icon}</span></div>`;
            }
            html += `<div class="card-item" data-path="${escapeHtml(f.path)}" data-type="${type}">
                ${thumbHtml}
                <div class="card-info">
                    <div class="card-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
                    <div class="card-meta">${formatSize(f.size)}</div>
                </div>
            </div>`;
        }
    } else {
        // Parent directory link
        if (!isRootPath(data.path) && data.path !== "/" && data.path.length > 1) {
            html += `<div class="tree-item parent-dir" data-path="${escapeHtml(parentPath)}" data-type="dir">
                <span class="icon">⬆</span>
                <span class="name">..</span>
            </div>`;
        }

        // Directories
        for (const d of data.dirs) {
            html += `<div class="tree-item" data-path="${escapeHtml(d.path)}" data-type="dir">
                <span class="icon">📁</span>
                <span class="name">${escapeHtml(d.name)}</span>
            </div>`;
        }

        // Files
        for (const f of data.files) {
            const ext = f.ext;
            const icon = fileIcon(ext);
            const type = ext === ".pdf" ? "pdf" : ext === ".zip" ? "zip" : imageExts.includes(ext) ? "image" : "other";
            html += `<div class="tree-item" data-path="${escapeHtml(f.path)}" data-type="${type}">
                <span class="icon">${icon}</span>
                <span class="name">${escapeHtml(f.name)}</span>
                <span class="size">${formatSize(f.size)}</span>
            </div>`;
        }
    }

    if (!html) {
        html = '<div class="loading">空目录</div>';
    }

    treeEl.innerHTML = html;

    const itemSelector = viewMode === "card" ? ".card-item" : ".tree-item";

    // Attach click handlers
    treeEl.querySelectorAll(itemSelector).forEach((item) => {
        item.addEventListener("click", () => {
            const type = item.dataset.type;
            const path = item.dataset.path;

            if (type === "dir") {
                navigateTo(path);
            } else {
                treeEl.querySelectorAll(itemSelector).forEach((i) => i.classList.remove("selected"));
                item.classList.add("selected");
                selectedPath = path;
                selectedType = type;
                updateSelectionInfo();
                clearCropTool();
                clearImageCropTool();
                loadImageInfoForResize();

                if (type === "pdf") {
                    showPdfPreview(path);
                } else {
                    clearPdfPreview();
                }
            }
        });

        item.addEventListener("dblclick", () => {
            if (item.dataset.type === "dir") {
                navigateTo(item.dataset.path);
            }
        });
    });
}

function toggleViewMode() {
    viewMode = viewMode === "list" ? "card" : "list";
    const btn = document.getElementById("viewToggleBtn");
    btn.classList.toggle("active", viewMode === "card");
    document.querySelector(".sidebar").classList.toggle("card-mode", viewMode === "card");
    if (lastBrowseData) {
        renderFileTree(lastBrowseData);
    }
}

function updateBreadcrumb(path) {
    const el = document.getElementById("breadcrumb");
    const normalizedRoot = normalizePath(rootPath);
    const normalizedPath = normalizePath(path);
    let html = `<span data-path="${escapeHtml(rootPath)}">根目录</span>`;
    let parts = [];

    if (normalizedPath !== normalizedRoot && normalizedRoot === "/") {
        parts = normalizedPath.split("/").filter(Boolean);
    } else if (normalizedPath !== normalizedRoot && normalizedPath.startsWith(`${normalizedRoot}/`)) {
        parts = normalizedPath.slice(normalizedRoot.length + 1).split("/").filter(Boolean);
    } else if (normalizedPath !== normalizedRoot) {
        parts = [normalizedPath.split("/").filter(Boolean).pop() || normalizedPath];
    }

    let accumulated = normalizedRoot === "/" ? "" : normalizedRoot;
    for (const part of parts) {
        accumulated = `${accumulated}/${part}`;
        html += `<span data-path="${escapeHtml(accumulated)}">${escapeHtml(part)}</span>`;
    }

    el.innerHTML = html;
    el.querySelectorAll("span").forEach((span) => {
        span.addEventListener("click", () => navigateTo(span.dataset.path));
    });
}

function updateSelectionInfo() {
    const el = document.getElementById("selectionInfo");
    if (!selectedPath) {
        el.innerHTML = `<p>请在左侧选择一个目录或文件</p>
            <div class="path">${escapeHtml(currentPath)}</div>`;
        return;
    }

    const typeLabel = {
        dir: "目录",
        pdf: "PDF 文件",
        zip: "ZIP 文件",
        image: "图片文件",
        other: "文件",
    };

    el.innerHTML = `<p>已选择: <strong>${typeLabel[selectedType] || "文件"}</strong></p>
        <div class="path">${escapeHtml(selectedPath)}</div>`;
}

// =====================================================
// Scan
// =====================================================

async function scanDirectory() {
    const path = currentPath;
    if (!path) return;

    log(`\n--- 扫描目录: ${path} ---\n`);
    const data = await api("scan", { path });
    if (data.error) {
        log(`[错误] ${data.error}\n`);
        return;
    }

    log(`PDF 文件: ${data.pdfs.length} 个`);
    for (const p of data.pdfs) {
        log(`  ${p.rel}`);
    }
    log(`\nZIP 文件: ${data.zips.length} 个`);
    for (const z of data.zips) {
        log(`  ${z.rel}`);
    }
    log("\n扫描完成。\n");
}

async function refreshDirectory() {
    if (!currentPath) return;
    await navigateTo(currentPath);
    log(`刷新目录: ${currentPath}`);
}

// =====================================================
// Actions
// =====================================================

async function doResize() {
    if (isRunning) return;
    const folder = currentPath;
    if (!folder) return alert("请先选择一个目录");

    setButtonsDisabled(true);
    log("\n=== 开始页面缩放 ===\n");

    const data = {
        folder,
        width: parseFloat(document.getElementById("resizeWidth").value),
        height: parseFloat(document.getElementById("resizeHeight").value),
        strip: document.getElementById("resizeStrip").checked,
    };

    if (selectedType === "pdf") {
        data.file = selectedPath;
    }

    const success = await apiStream("resize", data, (line, replace) => log(line, replace));
    log(success ? "\n=== 缩放完成 ===\n" : "\n=== 缩放失败 ===\n");
    setButtonsDisabled(false);
    navigateTo(currentPath);
}

async function doDelete() {
    if (isRunning) return;
    const folder = currentPath;
    if (!folder) return alert("请先选择一个目录");

    const mode = document.getElementById("deleteMode").value;

    const data = { folder };

    if (mode === "single") {
        const count = parseInt(document.getElementById("deleteCount").value);
        if (!count || count < 1) return alert("请输入有效页码");
        data.single = count;
    } else if (mode === "range") {
        const count = parseInt(document.getElementById("deleteCount").value);
        if (!count || count < 1) return alert("请输入有效页数");
        data.range = count;
        data.back = document.getElementById("deleteBack").checked;
    } else if (mode === "range-se") {
        const start = parseInt(document.getElementById("deleteStart").value);
        const end = parseInt(document.getElementById("deleteEnd").value);
        if (!start || !end || start < 1 || end < start) return alert("请输入有效的起止页码");
        data.range_start = start;
        data.range_end = end;
    }

    if (selectedType === "pdf") {
        data.file = selectedPath;
    }

    setButtonsDisabled(true);
    log("\n=== 开始页面删除 ===\n");

    const success = await apiStream("delete", data, (line, replace) => log(line, replace));
    log(success ? "\n=== 删除完成 ===\n" : "\n=== 删除失败 ===\n");
    setButtonsDisabled(false);
    navigateTo(currentPath);
}

async function doExtract() {
    if (isRunning) return;
    const folder = currentPath;
    if (!folder) return alert("请先选择一个目录");

    if (selectedType !== "pdf") return alert("请先在左侧选择一个 PDF 文件");

    const mode = document.getElementById("extractMode").value;

    setButtonsDisabled(true);
    log("\n=== 开始页面提取 ===\n");

    let success;
    if (mode === "png") {
        success = await apiStream("extract-png", {
            folder,
            file: selectedPath,
            page: parseInt(document.getElementById("extractPage").value),
            dpi_mode: document.getElementById("extractDpi").value,
        }, (line, replace) => log(line, replace));
    } else {
        success = await apiStream("extract-pdf", {
            folder,
            file: selectedPath,
            start: parseInt(document.getElementById("extractStart").value),
            end: parseInt(document.getElementById("extractEnd").value),
        }, (line, replace) => log(line, replace));
    }

    log(success ? "\n=== 提取完成 ===\n" : "\n=== 提取失败 ===\n");
    setButtonsDisabled(false);
    navigateTo(currentPath);
}

async function doZip2pdf() {
    if (isRunning) return;
    const folder = currentPath;
    if (!folder) return alert("请先选择一个目录");

    setButtonsDisabled(true);
    log("\n=== 开始 ZIP 转 PDF ===\n");

    const data = {
        folder,
        dpi_mode: document.getElementById("zipDpi").value,
    };

    if (selectedType === "zip") {
        data.file = selectedPath;
    }

    const success = await apiStream("zip2pdf", data, (line, replace) => log(line, replace));
    log(success ? "\n=== 转换完成 ===\n" : "\n=== 转换失败 ===\n");
    setButtonsDisabled(false);
    navigateTo(currentPath);
}

async function doClean() {
    if (isRunning) return;
    const folder = currentPath;
    if (!folder) return alert("请先选择一个目录");

    if (!confirm("确定要执行清理操作吗？此操作不可撤销。")) return;

    setButtonsDisabled(true);
    log("\n=== 开始清理 ===\n");

    const success = await apiStream("clean", {
        folder,
        type: document.getElementById("cleanType").value,
    }, (line, replace) => log(line, replace));

    log(success ? "\n=== 清理完成 ===\n" : "\n=== 清理失败 ===\n");
    setButtonsDisabled(false);
    navigateTo(currentPath);
}

// =====================================================
// Event Binding
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("[Debug] DOMContentLoaded fired");

    // Initial navigation
    rootPath = document.querySelector(".sidebar").dataset.root || "";
    console.log("[Debug] rootPath =", rootPath);
    document.querySelector(".content").classList.add("hide-log");
    navigateTo(rootPath);
    console.log("[Debug] navigateTo called");

    // Root navigation
    document.getElementById("rootBtn").addEventListener("click", () => {
        navigateTo(rootPath);
    });

    // Scan
    document.getElementById("scanBtn").addEventListener("click", scanDirectory);
    document.getElementById("refreshBtn").addEventListener("click", refreshDirectory);

    // View toggle
    document.getElementById("viewToggleBtn").addEventListener("click", toggleViewMode);

    // Main pages (P brand toggle)
    document.querySelectorAll(".mode-opt").forEach((opt) => {
        opt.addEventListener("click", () => {
            switchMainPage(opt.dataset.page);
        });
    });

    // PDF tabs
    const pdfPage = document.getElementById("pdfPage");
    pdfPage.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            switchToTab(tab.dataset.tab);
        });
    });

    // Image tabs
    const imagePage = document.getElementById("imagePage");
    imagePage.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            switchImageTab(tab.dataset.imageTab);
        });
    });

    // Extract mode toggle
    document.getElementById("extractMode").addEventListener("change", (e) => {
        const isPng = e.target.value === "png";
        document.getElementById("extractPageGroup").classList.toggle("hidden", !isPng);
        document.getElementById("extractDpiGroup").classList.toggle("hidden", !isPng);
        document.getElementById("extractStartGroup").classList.toggle("hidden", isPng);
        document.getElementById("extractEndGroup").classList.toggle("hidden", isPng);
    });

    document.getElementById("cropLoadBtn").addEventListener("click", loadCropPage);
    document.getElementById("cropSaveBtn").addEventListener("click", doCropSave);
    document.getElementById("cropRatio").addEventListener("change", applyCropRatioToCurrentBox);
    document.getElementById("cropZoom").addEventListener("input", (e) => {
        setCropZoomPercent(parseInt(e.target.value));
    });
    document.getElementById("cropZoomOutBtn").addEventListener("click", () => {
        setCropZoomPercent(Math.round(cropState.zoom * 100) - 10);
    });
    document.getElementById("cropZoomInBtn").addEventListener("click", () => {
        setCropZoomPercent(Math.round(cropState.zoom * 100) + 10);
    });
    document.getElementById("cropZoomResetBtn").addEventListener("click", () => {
        setCropZoomPercent(100);
    });
    bindCropStageEvents();

    document.getElementById("imageResizeBtn").addEventListener("click", doImageResize);
    document.querySelectorAll(".resize-preset").forEach(btn => {
        btn.addEventListener("click", () => applyResizePreset(btn.dataset.resizePreset));
    });
    document.querySelectorAll(".resize-scale").forEach(btn => {
        btn.addEventListener("click", () => applyResizeScale(btn.dataset.resizeScale));
    });
    document.getElementById("imageResizeResetBtn").addEventListener("click", resetImageResizeSettings);
    document.getElementById("imageResizeLockBtn").addEventListener("click", toggleResizeLock);
    document.getElementById("imageResizeWidthPct").addEventListener("input", () => {
        if (imageResizeLockRatio && imageResizeOriginalWidth > 0 && imageResizeOriginalHeight > 0) {
            const wPct = parseFloat(document.getElementById("imageResizeWidthPct").value) || 0;
            document.getElementById("imageResizeHeightPct").value = Math.round(wPct * 10) / 10;
        }
        updateResizeCalcDisplay();
    });
    document.getElementById("imageResizeHeightPct").addEventListener("input", () => {
        if (imageResizeLockRatio && imageResizeOriginalWidth > 0 && imageResizeOriginalHeight > 0) {
            const hPct = parseFloat(document.getElementById("imageResizeHeightPct").value) || 0;
            document.getElementById("imageResizeWidthPct").value = Math.round(hPct * 10) / 10;
        }
        updateResizeCalcDisplay();
    });
    document.getElementById("imageMergeBtn").addEventListener("click", doImageMerge);
    document.getElementById("imageCropLoadBtn").addEventListener("click", loadImageCrop);
    document.getElementById("imageCropSaveBtn").addEventListener("click", saveImageCrop);
    document.getElementById("imageCropRatio").addEventListener("change", () => {
        if (imageCropState.loadedPath) {
            const crop = getNormalizedImageCropBox();
            if (crop) restoreImageCropBoxFromNormalized(crop);
            else initDefaultImageCropBox();
        }
    });
    document.getElementById("imageCropZoom").addEventListener("input", (e) => {
        setImageCropZoomPercent(parseInt(e.target.value));
    });
    document.getElementById("imageCropZoomOutBtn").addEventListener("click", () => {
        setImageCropZoomPercent(Math.round(imageCropState.zoom * 100) - 10);
    });
    document.getElementById("imageCropZoomInBtn").addEventListener("click", () => {
        setImageCropZoomPercent(Math.round(imageCropState.zoom * 100) + 10);
    });
    document.getElementById("imageCropZoomResetBtn").addEventListener("click", () => {
        setImageCropZoomPercent(100);
    });
    document.getElementById("imageConvertBtn").addEventListener("click", doImageConvert);
    document.getElementById("imageCompressBtn").addEventListener("click", doImageCompress);
    bindImageCropEvents();

    // Delete mode toggle
    document.getElementById("deleteMode").addEventListener("change", (e) => {
        const mode = e.target.value;
        document.getElementById("deleteCountGroup").classList.toggle("hidden", mode === "range-se");
        document.getElementById("deleteStartGroup").classList.toggle("hidden", mode !== "range-se");
        document.getElementById("deleteEndGroup").classList.toggle("hidden", mode !== "range-se");
        document.getElementById("deleteBackGroup").classList.toggle("hidden", mode !== "range");
    });

    // Action buttons
    document.getElementById("resizeBtn").addEventListener("click", doResize);
    document.getElementById("deleteBtn").addEventListener("click", doDelete);
    document.getElementById("extractBtn").addEventListener("click", doExtract);
    document.getElementById("zip2pdfBtn").addEventListener("click", doZip2pdf);
    document.getElementById("cleanBtn").addEventListener("click", doClean);

    // Open folder in system file manager
    document.getElementById("openFolderBtn").addEventListener("click", async () => {
        try {
            const resp = await fetch("/api/open-folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folder: currentPath }),
            });
            const data = await resp.json();
            if (data.output) log(data.output);
        } catch (e) {
            log(`[错误] 打开目录失败: ${e}`);
        }
    });

    // Clear log
    document.getElementById("clearLogBtn").addEventListener("click", clearLog);

    // Shutdown server
    document.getElementById("shutdownBtn").addEventListener("click", async () => {
        if (!confirm("确定要关闭服务吗？关闭后需要手动重启。")) return;
        try {
            const resp = await fetch("/api/shutdown", { method: "POST" });
            const data = await resp.json();
            if (data.success) {
                document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:18px;color:#86868b;">服务已关闭，请手动重启。</div>';
            }
        } catch (e) {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:18px;color:#86868b;">服务已关闭。</div>';
        }
    });

    console.log("[Debug] All event handlers bound successfully");
});
