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
var PF = {
    currentPath: "",
    selectedPath: "",
    selectedType: "",
    isRunning: false,
    imagePreviewState: { loadedPath: "", naturalWidth: 0, naturalHeight: 0, baseWidth: 0 },
    imageCropState: { rect: null, drag: null, zoom: 1 },
    imageResizeOriginalWidth: 0,
    imageResizeOriginalHeight: 0,
    imageResizeLockRatio: true,
    imageResizeMode: "pixel",
    viewMode: "list",
    lastBrowseData: null,
    rootPath: "",
};

// =====================================================
// Shared Helpers
// =====================================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function byId(id) {
    return document.getElementById(id);
}

function numberValue(id, fallback = 0) {
    const value = parseFloat(byId(id)?.value);
    return Number.isFinite(value) ? value : fallback;
}

function intValue(id, fallback = 0) {
    const value = parseInt(byId(id)?.value, 10);
    return Number.isFinite(value) ? value : fallback;
}

function boolValue(id) {
    return Boolean(byId(id)?.checked);
}

function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
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
    return normalizePath(path) === normalizePath(PF.rootPath);
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

async function runToolAction({ start, success, failure, endpoint, payload, after, stream = true }) {
    if (PF.isRunning) return false;
    setButtonsDisabled(true);
    if (start) log(`\n=== ${start} ===\n`);
    const ok = stream
        ? await apiStream(endpoint, payload, (line, replace) => log(line, replace))
        : Boolean(await endpoint(payload));
    if (success || failure) log(ok ? `\n=== ${success} ===\n` : `\n=== ${failure} ===\n`);
    setButtonsDisabled(false);
    if (after) await after(ok);
    return ok;
}

function bindMainNavigation() {
    const langToggle = byId("langToggle");
    langToggle.addEventListener("click", switchLanguage);
    langToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchLanguage(); }
    });

    byId("rootBtn").addEventListener("click", () => navigateTo(PF.rootPath));
    byId("scanBtn").addEventListener("click", scanDirectory);
    byId("refreshBtn").addEventListener("click", refreshDirectory);
    byId("viewToggleBtn").addEventListener("click", toggleViewMode);

    const toggleMode = () => {
        const current = document.querySelector(".p-suffix-text.active")?.dataset.page;
        switchMainPage(current === "pdf" ? "image" : "pdf");
    };
    byId("modePill").addEventListener("click", toggleMode);
    byId("modePill").addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleMode();
        }
    });
}

function bindPageTabs() {
    byId("pdfPage").querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => switchToTab(tab.dataset.tab));
    });
    byId("imagePage").querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => switchImageTab(tab.dataset.imageTab));
    });
}

function bindPdfToolControls() {
    bindSegmentedControl("extractMode", (mode) => {
        const isPng = mode === "png";
        setHidden("extractPageGroup", !isPng);
        setHidden("extractDpiGroup", !isPng);
        setHidden("extractStartGroup", isPng);
        setHidden("extractEndGroup", isPng);
    });
    bindSegmentedControl("deleteMode", (mode) => {
        const isRange = mode === "range-se";
        setHidden("deleteCountGroup", isRange);
        setHidden("deleteBackGroup", isRange);
        setHidden("deleteStartGroup", !isRange);
        setHidden("deleteEndGroup", !isRange);
    });

    byId("resizeBtn").addEventListener("click", doResize);
    byId("deleteBtn").addEventListener("click", doDelete);
    byId("extractBtn").addEventListener("click", doExtract);
    byId("zip2pdfBtn").addEventListener("click", doZip2pdf);
    byId("metadataSaveBtn").addEventListener("click", savePdfMetadata);
    byId("metadataReloadBtn").addEventListener("click", loadPdfMetadata);

    document.querySelectorAll(".tab-clean .clean-btn").forEach(btn => {
        btn.addEventListener("click", () => doCleanType(btn.dataset.cleanType));
    });
}

function syncResizeDimensionInput(sourceId, targetId, ratio) {
    if (!PF.imageResizeLockRatio || PF.imageResizeOriginalWidth <= 0 || PF.imageResizeOriginalHeight <= 0) return;
    const value = numberValue(sourceId);
    byId(targetId).value = PF.imageResizeMode === "percent"
        ? Math.round(value * 10) / 10
        : Math.max(1, Math.round(value * ratio));
}

function bindImageToolControls() {
    byId("imageResizeBtn").addEventListener("click", doImageResize);
    document.querySelectorAll("[data-resize-mode]").forEach(btn => {
        btn.addEventListener("click", () => setImageResizeMode(btn.dataset.resizeMode));
    });
    byId("imageResizeResetBtn").addEventListener("click", resetImageResizeSettings);
    byId("imageResizeKeepRatio").addEventListener("change", toggleResizeLock);
    byId("imageResizeNoEnlarge").addEventListener("change", updateResizeCalcDisplay);
    byId("imageResizeWidthPct").addEventListener("input", () => {
        syncResizeDimensionInput("imageResizeWidthPct", "imageResizeHeightPct", PF.imageResizeOriginalHeight / PF.imageResizeOriginalWidth);
        updateResizeCalcDisplay();
    });
    byId("imageResizeHeightPct").addEventListener("input", () => {
        syncResizeDimensionInput("imageResizeHeightPct", "imageResizeWidthPct", PF.imageResizeOriginalWidth / PF.imageResizeOriginalHeight);
        updateResizeCalcDisplay();
    });

    byId("imageMergeBtn").addEventListener("click", doImageMerge);
    byId("imageCropSaveBtn").addEventListener("click", saveImageCrop);
    bindSegmentedControl("imageCropRatio", updateImageCropRatio);
    byId("imageCropZoom").addEventListener("input", (e) => setImageCropZoomPercent(parseInt(e.target.value, 10)));
    byId("imageCropZoomResetBtn").addEventListener("click", () => setImageCropZoomPercent(100));
    byId("imageConvertBtn").addEventListener("click", doImageConvert);
    byId("imageCompressBtn").addEventListener("click", doImageCompress);
    bindImageCropEvents();
}

function bindGenericSegmentedControls() {
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
}

function bindUtilityActions() {
    byId("openFolderBtn").addEventListener("click", async () => {
        try {
            const resp = await fetch("/api/open-folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folder: PF.currentPath }),
            });
            const data = await resp.json();
            if (data.output) log(data.output);
        } catch (e) {
            log(`[错误] 打开目录失败: ${e}`);
        }
    });

    byId("clearLogBtn").addEventListener("click", clearLog);
    byId("shutdownBtn").addEventListener("click", async () => {
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
}

// =====================================================
// Initialization & Event Binding
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    PF.rootPath = document.querySelector(".sidebar").dataset.root || "";
    applyTranslations();
    document.querySelector(".content").classList.add("pdf-mode");
    document.body.classList.add("pdf-mode");
    navigateTo(PF.rootPath);
    bindMainNavigation();
    bindPageTabs();
    bindPdfToolControls();
    bindImageToolControls();
    bindGenericSegmentedControls();
    bindUtilityActions();
});
