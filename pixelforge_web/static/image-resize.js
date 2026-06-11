// =====================================================
// Image Resize Tool
// =====================================================

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
    const widthValue = numberValue("imageResizeWidthPct");
    const heightValue = numberValue("imageResizeHeightPct");
    if (PF.imageResizeOriginalWidth > 0 && PF.imageResizeOriginalHeight > 0) {
        const size = calculateResizeOutput(widthValue, heightValue);
        setText("imageResizeCalcW", size.width);
        setText("imageResizeCalcH", size.height);
        setText("imageResizeCalcRatio", formatOutputRatio(size.width, size.height));
    } else {
        setText("imageResizeCalcW", "-");
        setText("imageResizeCalcH", "-");
        setText("imageResizeCalcRatio", "-");
    }
}

function calculateResizeOutput(widthValue, heightValue) {
    if (PF.imageResizeMode === "percent") {
        let w = Math.round(PF.imageResizeOriginalWidth * widthValue / 100);
        let h = Math.round(PF.imageResizeOriginalHeight * heightValue / 100);
        if (boolValue("imageResizeNoEnlarge")) {
            w = Math.min(w, PF.imageResizeOriginalWidth);
            h = Math.min(h, PF.imageResizeOriginalHeight);
        }
        return { width: Math.max(1, w), height: Math.max(1, h) };
    }

    let targetW = Math.max(1, Math.round(widthValue));
    let targetH = Math.max(1, Math.round(heightValue));
    if (PF.imageResizeLockRatio) {
        let scale = Math.min(targetW / PF.imageResizeOriginalWidth, targetH / PF.imageResizeOriginalHeight);
        if (boolValue("imageResizeNoEnlarge")) {
            scale = Math.min(scale, 1);
        }
        return {
            width: Math.max(1, Math.round(PF.imageResizeOriginalWidth * scale)),
            height: Math.max(1, Math.round(PF.imageResizeOriginalHeight * scale)),
        };
    }
    if (boolValue("imageResizeNoEnlarge")) {
        targetW = Math.min(targetW, PF.imageResizeOriginalWidth);
        targetH = Math.min(targetH, PF.imageResizeOriginalHeight);
    }
    return { width: targetW, height: targetH };
}

function setImageResizeMode(mode) {
    PF.imageResizeMode = mode;
    const wInput = byId("imageResizeWidthPct");
    const hInput = byId("imageResizeHeightPct");
    document.querySelectorAll("[data-resize-mode]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.resizeMode === mode);
    });
    const isPercent = mode === "percent";
    setText("imageResizeWidthLabel", isPercent ? "宽度 (%)" : "宽度 (px)");
    setText("imageResizeHeightLabel", isPercent ? "高度 (%)" : "高度 (px)");
    wInput.max = isPercent ? "1000" : "20000";
    hInput.max = isPercent ? "1000" : "20000";

    if (PF.imageResizeOriginalWidth > 0 && PF.imageResizeOriginalHeight > 0) {
        wInput.value = isPercent ? 100 : PF.imageResizeOriginalWidth;
        hInput.value = isPercent ? 100 : PF.imageResizeOriginalHeight;
    } else {
        wInput.value = isPercent ? 100 : "";
        hInput.value = isPercent ? 100 : "";
    }
    updateResizeCalcDisplay();
}

function toggleResizeLock() {
    PF.imageResizeLockRatio = boolValue("imageResizeKeepRatio");
    updateResizeCalcDisplay();
}

function resetImageResizeSettings() {
    byId("imageResizeKeepRatio").checked = true;
    byId("imageResizeNoEnlarge").checked = false;
    PF.imageResizeLockRatio = true;
    setImageResizeMode("pixel");
}

async function doImageResize() {
    if (!isSelectedImage()) return alert(t("alert.selectImage"));
    const widthValue = numberValue("imageResizeWidthPct");
    const heightValue = numberValue("imageResizeHeightPct");
    if (!widthValue || !heightValue || widthValue <= 0 || heightValue <= 0) return alert(t("alert.validSize"));
    await runToolAction({
        start: "开始图片拉伸",
        success: "图片拉伸完成",
        failure: "图片拉伸失败",
        endpoint: "image-resize",
        payload: {
            folder: PF.currentPath,
            file: PF.selectedPath,
            mode: PF.imageResizeMode,
            width: widthValue,
            height: heightValue,
            keep_ratio: PF.imageResizeLockRatio,
            no_enlarge: boolValue("imageResizeNoEnlarge"),
        },
        after: () => refreshDirectory(),
    });
}
