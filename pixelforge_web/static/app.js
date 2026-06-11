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
var currentPath = "";
var selectedPath = "";
var selectedType = "";
var isRunning = false;
var imagePreviewState = {
    loadedPath: "",
    naturalWidth: 0,
    naturalHeight: 0,
    baseWidth: 0,
};
var imageCropState = {
    rect: null,
    drag: null,
    zoom: 1,
};
var imageResizeOriginalWidth = 0;
var imageResizeOriginalHeight = 0;
var imageResizeLockRatio = true;
var imageResizeMode = "pixel";
var viewMode = "list";
var lastBrowseData = null;
var rootPath = "";

// =====================================================
// Shared Helpers
// =====================================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function byId(id) {
    return document.getElementById(id);
}

function setHidden(elOrId, hidden) {
    const el = typeof elOrId === "string" ? byId(elOrId) : elOrId;
    if (el) el.classList.toggle("hidden", hidden);
}

function setActiveControlOption(control, activeOption) {
    if (!control || !activeOption) return;
    control.querySelectorAll(".segmented-option").forEach((option) => {
        option.classList.toggle("active", option === activeOption);
    });
}

function optionDatasetValue(option, valueAttr = "value") {
    return option?.dataset?.[valueAttr] || "";
}

function bindSegmentedControl(id, onChange, valueAttr = "value") {
    const control = byId(id);
    if (!control) return;
    control.addEventListener("click", (event) => {
        const option = event.target.closest(".segmented-option");
        if (!option || !control.contains(option)) return;
        setActiveControlOption(control, option);
        if (onChange) onChange(optionDatasetValue(option, valueAttr), option);
    });
}

function isRootPath(path) {
    return normalizePath(path) === normalizePath(rootPath);
}

function getRatioValue(value) {
    const ratios = {
        "1:1": 1,
        a4p: 210 / 297,
        a4l: 297 / 210,
        "16:9": 16 / 9,
        "4:3": 4 / 3,
    };
    return ratios[value] || null;
}

function getSegmentedValue(id) {
    const el = document.querySelector("#" + id + " .segmented-option.active");
    return el ? el.dataset.value : "";
}

function setToolTab(pageEl, tabSelector, tabAttr, panelPrefix, tabName) {
    if (!pageEl) return;
    pageEl.querySelectorAll(".tab").forEach((tab) => {
        tab.classList.toggle("active", tab.matches(`${tabSelector}[data-${tabAttr}="${tabName}"]`));
    });
    pageEl.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `${panelPrefix}${tabName}`);
    });
}

function setImagePreviewMode(mode) {
    setHidden("imagePreviewEmpty", mode !== "empty");
    setHidden("imagePreviewFrame", mode === "empty");
    const frame = byId("imagePreviewFrame");
    if (frame) frame.classList.toggle("crop-mode", mode === "crop");
    setHidden("imageCropOverlay", mode !== "crop");
}

// =====================================================
// Initialization & Event Binding
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    rootPath = document.querySelector(".sidebar").dataset.root || "";
    applyTranslations();
    document.querySelector(".content").classList.add("pdf-mode");
    document.body.classList.add("pdf-mode");
    navigateTo(rootPath);

    const langToggle = document.getElementById("langToggle");
    langToggle.addEventListener("click", switchLanguage);
    langToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchLanguage(); }
    });

    document.getElementById("rootBtn").addEventListener("click", () => {
        navigateTo(rootPath);
    });

    document.getElementById("scanBtn").addEventListener("click", scanDirectory);
    document.getElementById("refreshBtn").addEventListener("click", refreshDirectory);

    document.getElementById("viewToggleBtn").addEventListener("click", toggleViewMode);

    document.getElementById("modePill").addEventListener("click", () => {
        const current = document.querySelector(".p-suffix-text.active")?.dataset.page;
        switchMainPage(current === "pdf" ? "image" : "pdf");
    });
    document.getElementById("modePill").addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const current = document.querySelector(".p-suffix-text.active")?.dataset.page;
            switchMainPage(current === "pdf" ? "image" : "pdf");
        }
    });

    const pdfPage = document.getElementById("pdfPage");
    pdfPage.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            switchToTab(tab.dataset.tab);
        });
    });

    const imagePage = document.getElementById("imagePage");
    imagePage.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            switchImageTab(tab.dataset.imageTab);
        });
    });

    bindSegmentedControl("extractMode", (mode) => {
        const isPng = mode === "png";
        setHidden("extractPageGroup", !isPng);
        setHidden("extractDpiGroup", !isPng);
        setHidden("extractStartGroup", isPng);
        setHidden("extractEndGroup", isPng);
    });

    document.getElementById("metadataSaveBtn").addEventListener("click", savePdfMetadata);
    document.getElementById("metadataReloadBtn").addEventListener("click", loadPdfMetadata);

    document.getElementById("imageResizeBtn").addEventListener("click", doImageResize);
    document.querySelectorAll("[data-resize-mode]").forEach(btn => {
        btn.addEventListener("click", () => setImageResizeMode(btn.dataset.resizeMode));
    });
    document.getElementById("imageResizeResetBtn").addEventListener("click", resetImageResizeSettings);
    document.getElementById("imageResizeKeepRatio").addEventListener("change", toggleResizeLock);
    document.getElementById("imageResizeNoEnlarge").addEventListener("change", updateResizeCalcDisplay);
    document.getElementById("imageResizeWidthPct").addEventListener("input", () => {
        if (imageResizeLockRatio && imageResizeOriginalWidth > 0 && imageResizeOriginalHeight > 0) {
            const widthValue = parseFloat(document.getElementById("imageResizeWidthPct").value) || 0;
            if (imageResizeMode === "percent") {
                document.getElementById("imageResizeHeightPct").value = Math.round(widthValue * 10) / 10;
            } else {
                document.getElementById("imageResizeHeightPct").value =
                    Math.max(1, Math.round(widthValue * imageResizeOriginalHeight / imageResizeOriginalWidth));
            }
        }
        updateResizeCalcDisplay();
    });
    document.getElementById("imageResizeHeightPct").addEventListener("input", () => {
        if (imageResizeLockRatio && imageResizeOriginalWidth > 0 && imageResizeOriginalHeight > 0) {
            const heightValue = parseFloat(document.getElementById("imageResizeHeightPct").value) || 0;
            if (imageResizeMode === "percent") {
                document.getElementById("imageResizeWidthPct").value = Math.round(heightValue * 10) / 10;
            } else {
                document.getElementById("imageResizeWidthPct").value =
                    Math.max(1, Math.round(heightValue * imageResizeOriginalWidth / imageResizeOriginalHeight));
            }
        }
        updateResizeCalcDisplay();
    });
    document.getElementById("imageMergeBtn").addEventListener("click", doImageMerge);
    document.getElementById("imageCropSaveBtn").addEventListener("click", saveImageCrop);
    bindSegmentedControl("imageCropRatio", () => {
        updateImageCropRatio();
    });
    document.getElementById("imageCropZoom").addEventListener("input", (e) => {
        setImageCropZoomPercent(parseInt(e.target.value));
    });
    document.getElementById("imageCropZoomResetBtn").addEventListener("click", () => {
        setImageCropZoomPercent(100);
    });
    document.getElementById("imageConvertBtn").addEventListener("click", doImageConvert);
    document.getElementById("imageCompressBtn").addEventListener("click", doImageCompress);
    bindImageCropEvents();

    bindSegmentedControl("deleteMode", (mode) => {
        const isRange = mode === "range-se";
        setHidden("deleteCountGroup", isRange);
        setHidden("deleteBackGroup", isRange);
        setHidden("deleteStartGroup", !isRange);
        setHidden("deleteEndGroup", !isRange);
    });

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".segmented-control .segmented-option");
        if (!btn) return;
        const control = btn.closest(".segmented-control");
        if (!control) return;
        const id = control.id;
        if (id === "extractMode" || id === "deleteMode" || id === "imageCropRatio") return;
        if (btn.hasAttribute("data-resize-mode")) return;
        setActiveControlOption(control, btn);
    });

    document.getElementById("resizeBtn").addEventListener("click", doResize);
    document.getElementById("deleteBtn").addEventListener("click", doDelete);
    document.getElementById("extractBtn").addEventListener("click", doExtract);
    document.getElementById("zip2pdfBtn").addEventListener("click", doZip2pdf);

    document.querySelectorAll(".tab-clean .clean-btn").forEach(btn => {
        btn.addEventListener("click", () => doCleanType(btn.dataset.cleanType));
    });

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

    document.getElementById("clearLogBtn").addEventListener("click", clearLog);

    document.getElementById("shutdownBtn").addEventListener("click", async () => {
        if (!confirm(t("alert.confirmShutdown"))) return;
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
});
