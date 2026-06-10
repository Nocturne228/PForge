// =====================================================
// Image Tools — Crop, Resize, Merge, Convert, Compress
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
    const ratio = getImageCropRatio();
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
    const ratio = getImageCropRatio();
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
    setImageCropBox({ x: 0, y: 0, w: width, h: height });
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

function ensureImageCropLoaded() {
    if (!isSelectedImage()) {
        clearImageCropTool();
        return;
    }
    if (imageCropState.loadedPath === selectedPath) {
        const { wrap } = imageCropEls();
        imageCropState.baseWidth = Math.min(
            imageCropState.naturalWidth,
            Math.max(320, wrap.clientWidth - 34),
        );
        const keepSelection = imageCropState.box && imageCropState.box.w > 12 && imageCropState.box.h > 12;
        applyImageCropZoom(imageCropState.zoom, keepSelection);
        return;
    }

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
    if (!isSelectedImage()) return alert(t("alert.selectImage"));
    if (!imageCropState.loadedPath || imageCropState.loadedPath !== selectedPath) {
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
    const { placeholder, wrap, img, box } = imageCropEls();
    placeholder.classList.remove("hidden");
    placeholder.innerHTML = "<p>选择左侧图片后即可拖拽框选</p>";
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
        document.getElementById("imagePreviewName").textContent = selectedPath.split("/").pop() || "未命名图片";
        const cropActive = getActiveImageTab() === "crop";
        document.getElementById("imagePreviewFrame").classList.toggle("hidden", cropActive);
        document.getElementById("imageCropPreview").classList.toggle("hidden", !cropActive);
        document.getElementById("imagePreviewEmpty").classList.add("hidden");

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
    document.getElementById("imagePreviewName").textContent = "未选择图片";
    document.getElementById("imagePreviewEmpty").classList.remove("hidden");
    document.getElementById("imagePreviewFrame").classList.add("hidden");
    document.getElementById("imageCropPreview").classList.add("hidden");
    document.getElementById("imageResizePreview").removeAttribute("src");
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
