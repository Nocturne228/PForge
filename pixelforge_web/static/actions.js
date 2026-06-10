// =====================================================
// Action Handlers — PDF/ZIP operations
// =====================================================

function setButtonsDisabled(disabled) {
    isRunning = disabled;
    document.querySelectorAll(".btn-primary, .btn-danger").forEach((btn) => {
        btn.disabled = disabled;
    });
}

async function doResize() {
    if (isRunning) return;
    const folder = currentPath;
    if (!folder) return alert(t("alert.selectDir"));

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
    if (!folder) return alert(t("alert.selectDir"));

    const mode = getSegmentedValue("deleteMode");

    const data = { folder };

    if (mode === "single") {
        const count = parseInt(document.getElementById("deleteCount").value);
        if (!count || count < 1) return alert(t("alert.validPage"));
        data.single = count;
        data.back = getSegmentedValue("deleteBack") === "back";
    } else if (mode === "range") {
        const count = parseInt(document.getElementById("deleteCount").value);
        if (!count || count < 1) return alert(t("alert.validCount"));
        data.range = count;
        data.back = getSegmentedValue("deleteBack") === "back";
    } else if (mode === "range-se") {
        const start = parseInt(document.getElementById("deleteStart").value);
        const end = parseInt(document.getElementById("deleteEnd").value);
        if (!start || !end || start < 1 || end < start) return alert(t("alert.validRange"));
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
    if (!folder) return alert(t("alert.selectDir"));

    if (selectedType !== "pdf") return alert(t("alert.selectPdf"));

    const mode = getSegmentedValue("extractMode");

    setButtonsDisabled(true);
    log("\n=== 开始页面提取 ===\n");

    let success;
    if (mode === "png") {
        success = await apiStream("extract-png", {
            folder,
            file: selectedPath,
            page: parseInt(document.getElementById("extractPage").value),
            dpi_mode: getSegmentedValue("extractDpi"),
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
    if (!folder) return alert(t("alert.selectDir"));

    setButtonsDisabled(true);
    log("\n=== 开始 ZIP 转 PDF ===\n");

    const data = {
        folder,
        dpi_mode: getSegmentedValue("zipDpi"),
    };

    if (selectedType === "zip") {
        data.file = selectedPath;
    }

    const success = await apiStream("zip2pdf", data, (line, replace) => log(line, replace));
    log(success ? "\n=== 转换完成 ===\n" : "\n=== 转换失败 ===\n");
    setButtonsDisabled(false);
    navigateTo(currentPath);
}

async function doCleanType(cleanType) {
    if (isRunning) return;
    const folder = currentPath;
    if (!folder) return alert(t("alert.selectDir"));
    if (!cleanType) return;

    if (!confirm(t("alert.confirmClean"))) return;

    setButtonsDisabled(true);
    log("\n=== 开始清理 ===\n");

    const success = await apiStream("clean", {
        folder,
        type: cleanType,
    }, (line, replace) => log(line, replace));

    log(success ? "\n=== 清理完成 ===\n" : "\n=== 清理失败 ===\n");
    setButtonsDisabled(false);
    navigateTo(currentPath);
}
