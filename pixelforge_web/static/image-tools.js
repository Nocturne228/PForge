// =====================================================
// Image Tools — Crop, Resize, Merge, Convert, Compress
// =====================================================

function isSelectedImage() {
    return selectedType === "image";
}

function imagePreviewEls() {
    return {
        frame: document.getElementById("imagePreviewFrame"),
        empty: document.getElementById("imagePreviewEmpty"),
        canvas: document.getElementById("imagePreviewCanvas"),
        img: document.getElementById("imageResizePreview"),
        overlay: document.getElementById("imageCropOverlay"),
        box: document.getElementById("imageCropBox"),
        zoom: document.getElementById("imageCropZoom"),
        zoomLabel: document.getElementById("imageCropZoomLabel"),
    };
}

function getImagePreviewSize() {
    const { canvas } = imagePreviewEls();
    return { width: canvas.clientWidth, height: canvas.clientHeight };
}

function computeImagePreviewBaseWidth(natW, natH) {
    const { frame } = imagePreviewEls();
    const availW = Math.max(320, frame.clientWidth - 36);
    const availH = Math.max(240, frame.clientHeight - 36);
    if (natW <= availW && natH <= availH) return natW;
    const scale = Math.min(availW / natW, availH / natH);
    return Math.max(320, Math.round(natW * scale));
}

function setImagePreviewZoom(percent) {
    const { canvas, zoom, zoomLabel } = imagePreviewEls();
    const clampedPercent = clamp(percent, 50, 300);
    imageCropState.zoom = clampedPercent / 100;
    if (zoom) zoom.value = String(clampedPercent);
    if (zoomLabel) zoomLabel.textContent = `${clampedPercent}%`;
    if (imagePreviewState.baseWidth > 0) {
        canvas.style.width = `${Math.round(imagePreviewState.baseWidth * imageCropState.zoom)}px`;
    }
    requestAnimationFrame(() => {
        renderImageCropBox();
    });
}

function resetImagePreviewZoom() {
    imageCropState.zoom = 1;
    setImagePreviewZoom(100);
}

function syncImagePreviewLayout() {
    if (imagePreviewState.loadedPath !== selectedPath || !imagePreviewState.naturalWidth) return;
    const crop = getNormalizedImageCropBox();
    imagePreviewState.baseWidth = computeImagePreviewBaseWidth(
        imagePreviewState.naturalWidth,
        imagePreviewState.naturalHeight,
    );
    setImagePreviewZoom(Math.round(imageCropState.zoom * 100));
    if (crop) {
        requestAnimationFrame(() => restoreImageCropBoxFromNormalized(crop));
    }
}

function constrainImageCropRect(rect) {
    const { width, height } = getImagePreviewSize();
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

function fitImageCropRatio(rect, ratio) {
    if (!ratio) return constrainImageCropRect(rect);
    const { width, height } = getImagePreviewSize();
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    let w = rect.w;
    let h = rect.h;
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
    if (w > width) {
        w = width;
        h = w / ratio;
    }
    if (h > height) {
        h = height;
        w = h * ratio;
    }
    return constrainImageCropRect({ x: cx - w / 2, y: cy - h / 2, w, h });
}

function setImageCropRect(rect) {
    imageCropState.rect = constrainImageCropRect(rect);
    renderImageCropBox();
}

function renderImageCropBox() {
    const { box } = imagePreviewEls();
    if (!box) return;
    const rect = imageCropState.rect;
    if (!rect) {
        box.classList.add("hidden");
        return;
    }
    const next = constrainImageCropRect(rect);
    imageCropState.rect = next;
    box.style.left = `${next.x}px`;
    box.style.top = `${next.y}px`;
    box.style.width = `${next.w}px`;
    box.style.height = `${next.h}px`;
    box.classList.remove("hidden");
}

function cropRectFromDrag(startX, startY, currentX, currentY) {
    const ratio = getImageCropRatio();
    const dx = currentX - startX;
    const dy = currentY - startY;
    let w = Math.max(12, Math.abs(dx));
    let h = Math.max(12, Math.abs(dy));
    if (ratio) {
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
    }
    return constrainImageCropRect({
        x: dx < 0 ? startX - w : startX,
        y: dy < 0 ? startY - h : startY,
        w,
        h,
    });
}

function cropRectFromResize(handle, startRect, point) {
    const ratio = getImageCropRatio();
    const minSize = 12;
    const left = startRect.x;
    const top = startRect.y;
    const right = startRect.x + startRect.w;
    const bottom = startRect.y + startRect.h;
    const west = handle.includes("w");
    const east = handle.includes("e");
    const north = handle.includes("n");
    const south = handle.includes("s");
    let anchorX = west ? right : left;
    let anchorY = north ? bottom : top;
    let w = west || east ? Math.max(minSize, Math.abs(point.x - anchorX)) : startRect.w;
    let h = north || south ? Math.max(minSize, Math.abs(point.y - anchorY)) : startRect.h;

    if (ratio) {
        if ((west || east) && !(north || south)) h = w / ratio;
        else if ((north || south) && !(west || east)) w = h * ratio;
        else if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
    }

    if (!west && !east) anchorX = (left + right) / 2;
    if (!north && !south) anchorY = (top + bottom) / 2;
    return constrainImageCropRect({
        x: west ? anchorX - w : east ? anchorX : anchorX - w / 2,
        y: north ? anchorY - h : south ? anchorY : anchorY - h / 2,
        w,
        h,
    });
}

function getImagePreviewPoint(event) {
    const { canvas } = imagePreviewEls();
    const rect = canvas.getBoundingClientRect();
    return {
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
    };
}

function resetImageCropSelection() {
    const { width, height } = getImagePreviewSize();
    if (!width || !height) {
        imageCropState.rect = null;
        renderImageCropBox();
        return;
    }
    const inset = Math.max(12, Math.round(Math.min(width, height) * 0.08));
    setImageCropRect(fitImageCropRatio({
        x: inset,
        y: inset,
        w: Math.max(12, width - inset * 2),
        h: Math.max(12, height - inset * 2),
    }, getImageCropRatio()));
}

function getNormalizedImageCropBox() {
    if (!imageCropState.rect) return null;
    const { width, height } = getImagePreviewSize();
    if (!width || !height) return null;
    return {
        x: imageCropState.rect.x / width,
        y: imageCropState.rect.y / height,
        width: imageCropState.rect.w / width,
        height: imageCropState.rect.h / height,
    };
}

function setImageCropZoomPercent(percent) {
    const crop = getNormalizedImageCropBox();
    setImagePreviewZoom(percent);
    requestAnimationFrame(() => {
        if (crop) restoreImageCropBoxFromNormalized(crop);
    });
}

function restoreImageCropBoxFromNormalized(crop) {
    const { width, height } = getImagePreviewSize();
    if (!crop || !width || !height) return;
    setImageCropRect({
        x: crop.x * width,
        y: crop.y * height,
        w: crop.width * width,
        h: crop.height * height,
    });
}

function ensureImageCropLoaded() {
    if (!isSelectedImage()) {
        clearImageCropTool();
        return;
    }
    if (imagePreviewState.loadedPath !== selectedPath) return;
    setImagePreviewMode("crop");
    if (!imageCropState.rect) resetImageCropSelection();
    else renderImageCropBox();
}

function updateImageCropRatio() {
    if (!isSelectedImage() || imagePreviewState.loadedPath !== selectedPath) return;
    if (!imageCropState.rect) resetImageCropSelection();
    else setImageCropRect(fitImageCropRatio(imageCropState.rect, getImageCropRatio()));
}

async function saveImageCrop() {
    if (isRunning) return;
    if (!isSelectedImage()) return alert(t("alert.selectImage"));
    if (imagePreviewState.loadedPath !== selectedPath) {
        ensureImageCropLoaded();
        return alert(t("alert.cropLoading"));
    }
    const crop = getNormalizedImageCropBox();
    if (!crop) return alert(t("alert.cropSelect"));
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
    const { box, overlay } = imagePreviewEls();
    if (box) box.classList.add("hidden");
    if (overlay) overlay.classList.add("hidden");
    imageCropState = {
        rect: null,
        drag: null,
        zoom: 1,
    };
    resetImagePreviewZoom();
}

function bindImageCropEvents() {
    const { canvas, box } = imagePreviewEls();
    canvas.addEventListener("mousedown", (event) => {
        if (!isSelectedImage() || getActiveImageTab() !== "crop") return;
        event.preventDefault();
        const point = getImagePreviewPoint(event);
        const handle = event.target.dataset.cropHandle;
        if (handle && imageCropState.rect) {
            imageCropState.drag = { mode: "resize", handle, rect: { ...imageCropState.rect } };
        } else if (event.target === box && imageCropState.rect) {
            imageCropState.drag = {
                mode: "move",
                startX: point.x,
                startY: point.y,
                rect: { ...imageCropState.rect },
            };
        } else {
            imageCropState.drag = { mode: "draw", startX: point.x, startY: point.y };
            setImageCropRect({ x: point.x, y: point.y, w: 12, h: 12 });
        }
    });
    window.addEventListener("mousemove", (event) => {
        if (!imageCropState.drag) return;
        const point = getImagePreviewPoint(event);
        if (imageCropState.drag.mode === "move") {
            const dx = point.x - imageCropState.drag.startX;
            const dy = point.y - imageCropState.drag.startY;
            setImageCropRect({
                x: imageCropState.drag.rect.x + dx,
                y: imageCropState.drag.rect.y + dy,
                w: imageCropState.drag.rect.w,
                h: imageCropState.drag.rect.h,
            });
        } else if (imageCropState.drag.mode === "resize") {
            setImageCropRect(cropRectFromResize(imageCropState.drag.handle, imageCropState.drag.rect, point));
        } else {
            setImageCropRect(cropRectFromDrag(imageCropState.drag.startX, imageCropState.drag.startY, point.x, point.y));
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
        const preview = imagePreviewEls();
        const cropActive = getActiveImageTab() === "crop";
        setImagePreviewMode(cropActive ? "crop" : "image");
        imagePreviewState.loadedPath = selectedPath;
        imagePreviewState.naturalWidth = img.naturalWidth;
        imagePreviewState.naturalHeight = img.naturalHeight;
        imagePreviewState.baseWidth = computeImagePreviewBaseWidth(img.naturalWidth, img.naturalHeight);
        imageResizeOriginalWidth = imagePreviewState.naturalWidth;
        imageResizeOriginalHeight = imagePreviewState.naturalHeight;

        document.getElementById("imageResizeOrigW").textContent = img.naturalWidth;
        document.getElementById("imageResizeOrigH").textContent = img.naturalHeight;
        preview.img.src = img.src;
        imageCropState.rect = null;
        resetImagePreviewZoom();
        if (cropActive) {
            requestAnimationFrame(resetImageCropSelection);
        }

        setImageResizeMode(imageResizeMode || "pixel");
        updateResizeCalcDisplay();
    };
    img.onerror = () => clearImageResizeInfo();
    img.src = `/api/image-file?path=${encodeURIComponent(selectedPath)}&v=${Date.now()}`;
}

function clearImageResizeInfo() {
    imageResizeOriginalWidth = 0;
    imageResizeOriginalHeight = 0;
    imageResizeLockRatio = true;
    imagePreviewState = {
        loadedPath: "",
        naturalWidth: 0,
        naturalHeight: 0,
        baseWidth: 0,
    };
    clearImageCropTool();
    setImagePreviewMode("empty");
    document.getElementById("imageResizePreview").removeAttribute("src");
    document.getElementById("imagePreviewCanvas").style.width = "";
    document.getElementById("imageResizeOrigW").textContent = "-";
    document.getElementById("imageResizeOrigH").textContent = "-";
    document.getElementById("imageResizeCalcW").textContent = "-";
    document.getElementById("imageResizeCalcH").textContent = "-";
    document.getElementById("imageResizeCalcRatio").textContent = "-";
    document.getElementById("imageResizeKeepRatio").checked = true;
    setImageResizeMode("pixel");
}

function getActiveImageTab() {
    const active = document.querySelector("#imagePage .tab.active");
    return active ? active.dataset.imageTab : "resize";
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
    const widthValue = parseFloat(document.getElementById("imageResizeWidthPct").value) || 0;
    const heightValue = parseFloat(document.getElementById("imageResizeHeightPct").value) || 0;
    if (imageResizeOriginalWidth > 0 && imageResizeOriginalHeight > 0) {
        const size = calculateResizeOutput(widthValue, heightValue);
        const w = size.width;
        const h = size.height;
        document.getElementById("imageResizeCalcW").textContent = w;
        document.getElementById("imageResizeCalcH").textContent = h;
        document.getElementById("imageResizeCalcRatio").textContent = formatOutputRatio(w, h);
    } else {
        document.getElementById("imageResizeCalcW").textContent = "-";
        document.getElementById("imageResizeCalcH").textContent = "-";
        document.getElementById("imageResizeCalcRatio").textContent = "-";
    }
}

function calculateResizeOutput(widthValue, heightValue) {
    if (imageResizeMode === "percent") {
        let w = Math.round(imageResizeOriginalWidth * widthValue / 100);
        let h = Math.round(imageResizeOriginalHeight * heightValue / 100);
        if (document.getElementById("imageResizeNoEnlarge").checked) {
            w = Math.min(w, imageResizeOriginalWidth);
            h = Math.min(h, imageResizeOriginalHeight);
        }
        return { width: Math.max(1, w), height: Math.max(1, h) };
    }

    let targetW = Math.max(1, Math.round(widthValue));
    let targetH = Math.max(1, Math.round(heightValue));
    if (imageResizeLockRatio) {
        let scale = Math.min(targetW / imageResizeOriginalWidth, targetH / imageResizeOriginalHeight);
        if (document.getElementById("imageResizeNoEnlarge").checked) {
            scale = Math.min(scale, 1);
        }
        return {
            width: Math.max(1, Math.round(imageResizeOriginalWidth * scale)),
            height: Math.max(1, Math.round(imageResizeOriginalHeight * scale)),
        };
    }
    if (document.getElementById("imageResizeNoEnlarge").checked) {
        targetW = Math.min(targetW, imageResizeOriginalWidth);
        targetH = Math.min(targetH, imageResizeOriginalHeight);
    }
    return { width: targetW, height: targetH };
}

function setImageResizeMode(mode) {
    imageResizeMode = mode;
    const wInput = document.getElementById("imageResizeWidthPct");
    const hInput = document.getElementById("imageResizeHeightPct");
    document.querySelectorAll("[data-resize-mode]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.resizeMode === mode);
    });
    const isPercent = mode === "percent";
    document.getElementById("imageResizeWidthLabel").textContent = isPercent ? "宽度 (%)" : "宽度 (px)";
    document.getElementById("imageResizeHeightLabel").textContent = isPercent ? "高度 (%)" : "高度 (px)";
    wInput.max = isPercent ? "1000" : "20000";
    hInput.max = isPercent ? "1000" : "20000";

    if (imageResizeOriginalWidth > 0 && imageResizeOriginalHeight > 0) {
        wInput.value = isPercent ? 100 : imageResizeOriginalWidth;
        hInput.value = isPercent ? 100 : imageResizeOriginalHeight;
    } else {
        wInput.value = isPercent ? 100 : "";
        hInput.value = isPercent ? 100 : "";
    }
    updateResizeCalcDisplay();
}

function toggleResizeLock() {
    imageResizeLockRatio = document.getElementById("imageResizeKeepRatio").checked;
    updateResizeCalcDisplay();
}

function resetImageResizeSettings() {
    document.getElementById("imageResizeKeepRatio").checked = true;
    document.getElementById("imageResizeNoEnlarge").checked = false;
    imageResizeLockRatio = true;
    setImageResizeMode("pixel");
}

async function doImageResize() {
    if (!isSelectedImage()) return alert(t("alert.selectImage"));
    const widthValue = parseFloat(document.getElementById("imageResizeWidthPct").value);
    const heightValue = parseFloat(document.getElementById("imageResizeHeightPct").value);
    if (!widthValue || !heightValue || widthValue <= 0 || heightValue <= 0) return alert(t("alert.validSize"));
    setButtonsDisabled(true);
    log("\n=== 开始图片拉伸 ===\n");
    const success = await apiStream("image-resize", {
        folder: currentPath,
        file: selectedPath,
        mode: imageResizeMode,
        width: widthValue,
        height: heightValue,
        keep_ratio: imageResizeLockRatio,
        no_enlarge: document.getElementById("imageResizeNoEnlarge").checked,
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
        mode: getSegmentedValue("imageMergeMode"),
        border: document.getElementById("imageMergeBorder").checked,
    }, (line, replace) => log(line, replace));
    log(success ? "\n=== 图片合并完成 ===\n" : "\n=== 图片合并失败 ===\n");
    setButtonsDisabled(false);
    refreshDirectory();
}

async function doImageConvert() {
    const scope = getSegmentedValue("imageConvertScope");
    if (scope === "selected" && !isSelectedImage()) return alert(t("alert.selectImage"));
    setButtonsDisabled(true);
    log("\n=== 开始格式转换 ===\n");
    const success = await apiStream("image-convert", {
        folder: currentPath,
        file: selectedPath,
        scope,
        format: getSegmentedValue("imageConvertFormat"),
    }, (line, replace) => log(line, replace));
    log(success ? "\n=== 格式转换完成 ===\n" : "\n=== 格式转换失败 ===\n");
    setButtonsDisabled(false);
    refreshDirectory();
}

async function doImageCompress() {
    const scope = getSegmentedValue("imageCompressScope");
    if (scope === "selected" && !isSelectedImage()) return alert(t("alert.selectImage"));
    const maxSideValue = document.getElementById("imageCompressMaxSide").value;
    const targetKbValue = document.getElementById("imageCompressTargetKb").value;
    setButtonsDisabled(true);
    log("\n=== 开始图片压缩 ===\n");
    const success = await apiStream("image-compress", {
        folder: currentPath,
        file: selectedPath,
        scope,
        quality: parseInt(document.getElementById("imageCompressQuality").value),
        max_side: maxSideValue ? parseInt(maxSideValue) : null,
        target_kb: targetKbValue ? parseInt(targetKbValue) : null,
        best_quality: document.getElementById("imageCompressBestQuality").checked,
    }, (line, replace) => log(line, replace));
    log(success ? "\n=== 图片压缩完成 ===\n" : "\n=== 图片压缩失败 ===\n");
    setButtonsDisabled(false);
    refreshDirectory();
}

function getImageCropRatio() {
    const active = document.querySelector("#imageCropRatio .segmented-option.active");
    return getRatioValue(active?.dataset.cropRatio || "free");
}
