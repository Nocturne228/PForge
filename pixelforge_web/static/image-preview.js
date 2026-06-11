// =====================================================
// Shared Image Preview
// =====================================================

function isSelectedImage() {
    return PF.selectedType === "image";
}

function imagePreviewEls() {
    return {
        frame: byId("imagePreviewFrame"),
        empty: byId("imagePreviewEmpty"),
        canvas: byId("imagePreviewCanvas"),
        img: byId("imageResizePreview"),
        overlay: byId("imageCropOverlay"),
        box: byId("imageCropBox"),
        zoom: byId("imageCropZoom"),
        zoomLabel: byId("imageCropZoomLabel"),
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
    PF.imageCropState.zoom = clampedPercent / 100;
    if (zoom) zoom.value = String(clampedPercent);
    if (zoomLabel) zoomLabel.textContent = `${clampedPercent}%`;
    if (PF.imagePreviewState.baseWidth > 0) {
        canvas.style.width = `${Math.round(PF.imagePreviewState.baseWidth * PF.imageCropState.zoom)}px`;
    }
    requestAnimationFrame(() => {
        renderImageCropBox();
    });
}

function resetImagePreviewZoom() {
    PF.imageCropState.zoom = 1;
    setImagePreviewZoom(100);
}

function syncImagePreviewLayout() {
    if (PF.imagePreviewState.loadedPath !== PF.selectedPath || !PF.imagePreviewState.naturalWidth) return;
    const crop = getNormalizedImageCropBox();
    PF.imagePreviewState.baseWidth = computeImagePreviewBaseWidth(
        PF.imagePreviewState.naturalWidth,
        PF.imagePreviewState.naturalHeight,
    );
    setImagePreviewZoom(Math.round(PF.imageCropState.zoom * 100));
    if (crop) {
        requestAnimationFrame(() => restoreImageCropBoxFromNormalized(crop));
    }
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
        PF.imagePreviewState.loadedPath = PF.selectedPath;
        PF.imagePreviewState.naturalWidth = img.naturalWidth;
        PF.imagePreviewState.naturalHeight = img.naturalHeight;
        PF.imagePreviewState.baseWidth = computeImagePreviewBaseWidth(img.naturalWidth, img.naturalHeight);
        PF.imageResizeOriginalWidth = PF.imagePreviewState.naturalWidth;
        PF.imageResizeOriginalHeight = PF.imagePreviewState.naturalHeight;

        setText("imageResizeOrigW", img.naturalWidth);
        setText("imageResizeOrigH", img.naturalHeight);
        preview.img.src = img.src;
        PF.imageCropState.rect = null;
        resetImagePreviewZoom();
        if (cropActive) {
            requestAnimationFrame(resetImageCropSelection);
        }

        setImageResizeMode(PF.imageResizeMode || "pixel");
        updateResizeCalcDisplay();
    };
    img.onerror = () => clearImageResizeInfo();
    img.src = `/api/image-file?path=${encodeURIComponent(PF.selectedPath)}&v=${Date.now()}`;
}

function clearImageResizeInfo() {
    PF.imageResizeOriginalWidth = 0;
    PF.imageResizeOriginalHeight = 0;
    PF.imageResizeLockRatio = true;
    PF.imagePreviewState = {
        loadedPath: "",
        naturalWidth: 0,
        naturalHeight: 0,
        baseWidth: 0,
    };
    clearImageCropTool();
    setImagePreviewMode("empty");
    byId("imageResizePreview").removeAttribute("src");
    byId("imagePreviewCanvas").style.width = "";
    setText("imageResizeOrigW", "-");
    setText("imageResizeOrigH", "-");
    setText("imageResizeCalcW", "-");
    setText("imageResizeCalcH", "-");
    setText("imageResizeCalcRatio", "-");
    byId("imageResizeKeepRatio").checked = true;
    setImageResizeMode("pixel");
}

function getActiveImageTab() {
    const active = document.querySelector("#imagePage .tab.active");
    return active ? active.dataset.imageTab : "resize";
}
