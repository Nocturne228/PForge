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
var imageCropState = {
    loadedPath: "",
    box: null,
    drag: null,
    naturalWidth: 0,
    naturalHeight: 0,
    baseWidth: 0,
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

    document.querySelectorAll("#extractMode .segmented-option").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#extractMode .segmented-option").forEach(o => o.classList.toggle("active", o === btn));
            const isPng = btn.dataset.value === "png";
            document.getElementById("extractPageGroup").classList.toggle("hidden", !isPng);
            document.getElementById("extractDpiGroup").classList.toggle("hidden", !isPng);
            document.getElementById("extractStartGroup").classList.toggle("hidden", isPng);
            document.getElementById("extractEndGroup").classList.toggle("hidden", isPng);
        });
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
    document.querySelectorAll("#imageCropRatio .segmented-option").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#imageCropRatio .segmented-option").forEach((option) => {
                option.classList.toggle("active", option === btn);
            });
            if (imageCropState.loadedPath) {
                const crop = getNormalizedImageCropBox();
                if (crop) restoreImageCropBoxFromNormalized(crop);
                else initDefaultImageCropBox();
            }
        });
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

    document.querySelectorAll("#deleteMode .segmented-option").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#deleteMode .segmented-option").forEach(o => o.classList.toggle("active", o === btn));
            const mode = btn.dataset.value;
            document.getElementById("deleteCountGroup").classList.toggle("hidden", mode === "range-se");
            document.getElementById("deleteBackGroup").classList.toggle("hidden", mode === "range-se");
            document.getElementById("deleteStartGroup").classList.toggle("hidden", mode !== "range-se");
            document.getElementById("deleteEndGroup").classList.toggle("hidden", mode !== "range-se");
        });
    });

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".segmented-control .segmented-option");
        if (!btn) return;
        const control = btn.closest(".segmented-control");
        if (!control) return;
        const id = control.id;
        if (id === "extractMode" || id === "deleteMode" || id === "imageCropRatio") return;
        if (btn.hasAttribute("data-resize-mode")) return;
        control.querySelectorAll(".segmented-option").forEach(o => o.classList.toggle("active", o === btn));
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
