// =====================================================
// Image Crop Tool
// =====================================================

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
    PF.imageCropState.rect = constrainImageCropRect(rect);
    renderImageCropBox();
}

function renderImageCropBox() {
    const { box } = imagePreviewEls();
    if (!box) return;
    const rect = PF.imageCropState.rect;
    if (!rect) {
        box.classList.add("hidden");
        return;
    }
    const next = constrainImageCropRect(rect);
    PF.imageCropState.rect = next;
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
        PF.imageCropState.rect = null;
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
    if (!PF.imageCropState.rect) return null;
    const { width, height } = getImagePreviewSize();
    if (!width || !height) return null;
    return {
        x: PF.imageCropState.rect.x / width,
        y: PF.imageCropState.rect.y / height,
        width: PF.imageCropState.rect.w / width,
        height: PF.imageCropState.rect.h / height,
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
    if (PF.imagePreviewState.loadedPath !== PF.selectedPath) return;
    setImagePreviewMode("crop");
    if (!PF.imageCropState.rect) resetImageCropSelection();
    else renderImageCropBox();
}

function updateImageCropRatio() {
    if (!isSelectedImage() || PF.imagePreviewState.loadedPath !== PF.selectedPath) return;
    if (!PF.imageCropState.rect) resetImageCropSelection();
    else setImageCropRect(fitImageCropRatio(PF.imageCropState.rect, getImageCropRatio()));
}

async function saveImageCrop() {
    if (PF.isRunning) return;
    if (!isSelectedImage()) return alert(t("alert.selectImage"));
    if (PF.imagePreviewState.loadedPath !== PF.selectedPath) {
        ensureImageCropLoaded();
        return alert(t("alert.cropLoading"));
    }
    const crop = getNormalizedImageCropBox();
    if (!crop) return alert(t("alert.cropSelect"));
    await runToolAction({
        start: "开始图片截取",
        success: "图片截取完成",
        failure: "图片截取失败",
        endpoint: "image-crop",
        payload: { folder: PF.currentPath, file: PF.selectedPath, crop },
    });
}

function clearImageCropTool() {
    const { box, overlay } = imagePreviewEls();
    if (box) box.classList.add("hidden");
    if (overlay) overlay.classList.add("hidden");
    PF.imageCropState = {
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
        if (handle && PF.imageCropState.rect) {
            PF.imageCropState.drag = { mode: "resize", handle, rect: { ...imageCropState.rect } };
        } else if (event.target === box && PF.imageCropState.rect) {
            PF.imageCropState.drag = {
                mode: "move",
                startX: point.x,
                startY: point.y,
                rect: { ...imageCropState.rect },
            };
        } else {
            PF.imageCropState.drag = { mode: "draw", startX: point.x, startY: point.y };
            setImageCropRect({ x: point.x, y: point.y, w: 12, h: 12 });
        }
    });
    window.addEventListener("mousemove", (event) => {
        if (!PF.imageCropState.drag) return;
        const point = getImagePreviewPoint(event);
        if (PF.imageCropState.drag.mode === "move") {
            const dx = point.x - PF.imageCropState.drag.startX;
            const dy = point.y - PF.imageCropState.drag.startY;
            setImageCropRect({
                x: PF.imageCropState.drag.rect.x + dx,
                y: PF.imageCropState.drag.rect.y + dy,
                w: PF.imageCropState.drag.rect.w,
                h: PF.imageCropState.drag.rect.h,
            });
        } else if (PF.imageCropState.drag.mode === "resize") {
            setImageCropRect(cropRectFromResize(PF.imageCropState.drag.handle, PF.imageCropState.drag.rect, point));
        } else {
            setImageCropRect(cropRectFromDrag(PF.imageCropState.drag.startX, PF.imageCropState.drag.startY, point.x, point.y));
        }
    });
    window.addEventListener("mouseup", () => {
        PF.imageCropState.drag = null;
    });
}

function getImageCropRatio() {
    const active = document.querySelector("#imageCropRatio .segmented-option.active");
    return getRatioValue(active?.dataset.cropRatio || "free");
}
