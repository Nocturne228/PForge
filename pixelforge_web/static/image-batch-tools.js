// =====================================================
// Image Batch Tools — Merge, Convert, Compress
// =====================================================

async function doImageMerge() {
    await runToolAction({
        start: "开始图片合并",
        success: "图片合并完成",
        failure: "图片合并失败",
        endpoint: "image-merge",
        payload: {
            folder: PF.currentPath,
            mode: getSegmentedValue("imageMergeMode"),
            border: boolValue("imageMergeBorder"),
        },
        after: () => refreshDirectory(),
    });
}

async function doImageConvert() {
    const scope = getSegmentedValue("imageConvertScope");
    if (scope === "selected" && !isSelectedImage()) return alert(t("alert.selectImage"));
    await runToolAction({
        start: "开始格式转换",
        success: "格式转换完成",
        failure: "格式转换失败",
        endpoint: "image-convert",
        payload: {
            folder: PF.currentPath,
            file: PF.selectedPath,
            scope,
            format: getSegmentedValue("imageConvertFormat"),
        },
        after: () => refreshDirectory(),
    });
}

async function doImageCompress() {
    const scope = getSegmentedValue("imageCompressScope");
    if (scope === "selected" && !isSelectedImage()) return alert(t("alert.selectImage"));
    const maxSideValue = byId("imageCompressMaxSide").value;
    const targetKbValue = byId("imageCompressTargetKb").value;
    await runToolAction({
        start: "开始图片压缩",
        success: "图片压缩完成",
        failure: "图片压缩失败",
        endpoint: "image-compress",
        payload: {
            folder: PF.currentPath,
            file: PF.selectedPath,
            scope,
            quality: intValue("imageCompressQuality"),
            max_side: maxSideValue ? parseInt(maxSideValue, 10) : null,
            target_kb: targetKbValue ? parseInt(targetKbValue, 10) : null,
            best_quality: boolValue("imageCompressBestQuality"),
        },
        after: () => refreshDirectory(),
    });
}
