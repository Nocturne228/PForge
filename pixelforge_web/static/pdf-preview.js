// =====================================================
// PDF Preview & Metadata
// =====================================================

function switchToTab(tabName) {
    const pdfPage = document.getElementById("pdfPage");
    if (!pdfPage) return;

    setToolTab(pdfPage, ".tab", "tab", "panel-", tabName);

    if (tabName === "metadata") {
        loadPdfMetadata();
    }
}

function switchMainPage(pageName) {
    document.querySelectorAll(".p-suffix-text").forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.page === pageName);
    });
    const modePill = document.getElementById("modePill");
    if (modePill) modePill.dataset.active = pageName;

    document.querySelectorAll(".tool-page").forEach((page) => {
        page.classList.toggle("active", page.id === `${pageName}Page`);
    });

    const content = document.querySelector(".content");
    content.classList.toggle("pdf-mode", pageName === "pdf");
    content.classList.toggle("image-mode", pageName === "image");
    document.body.classList.toggle("pdf-mode", pageName === "pdf");
    document.body.classList.toggle("image-mode", pageName === "image");
    if (pageName === "image") {
        switchImageTab(getActiveImageTab());
    } else {
        const activePdfTab = document.querySelector("#pdfPage .tab.active");
        switchToTab(activePdfTab?.dataset.tab || "resize");
    }
}

function switchImageTab(tabName) {
    const imagePage = document.getElementById("imagePage");
    if (!imagePage) return;

    setToolTab(imagePage, ".tab", "image-tab", "image-panel-", tabName);

    const selectedImage = isSelectedImage();
    setImagePreviewMode(!selectedImage ? "empty" : tabName === "crop" ? "crop" : "image");
    if (selectedImage && typeof syncImagePreviewLayout === "function") {
        syncImagePreviewLayout();
    }
    if (tabName === "crop") {
        ensureImageCropLoaded();
    }
}

async function showPdfPreview(filePath) {
    const placeholder = document.getElementById("previewPlaceholder");
    const container = document.getElementById("previewContainer");
    const frame = document.getElementById("previewFrame");
    const dims = document.getElementById("pdfPreviewDims");

    placeholder.classList.remove("hidden");
    placeholder.innerHTML = `<p>${t("preview.loading")}</p>`;
    container.classList.add("hidden");

    try {
        const resp = await fetch("/api/pdf-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: filePath }),
        });
        const data = await resp.json();

        if (data.error) {
            placeholder.innerHTML = `<p>${escapeHtml(data.error)}</p>`;
            return;
        }

        dims.textContent = `${data.pages} ${t("preview.pages")} · ${data.width_mm} x ${data.height_mm} mm · ${formatSize(data.size)}`;

        frame.src = "/api/pdf-file?path=" + encodeURIComponent(filePath);
        placeholder.classList.add("hidden");
        container.classList.remove("hidden");
    } catch (e) {
        placeholder.innerHTML = `<p>${t("preview.loadError")} ${escapeHtml(e.message)}</p>`;
    }
}

function clearPdfPreview() {
    const placeholder = document.getElementById("previewPlaceholder");
    const container = document.getElementById("previewContainer");
    const frame = document.getElementById("previewFrame");
    const dims = document.getElementById("pdfPreviewDims");

    placeholder.classList.remove("hidden");
    placeholder.innerHTML = `<p>${t("previewPlaceholder")}</p>`;
    container.classList.add("hidden");
    frame.src = "";
    dims.textContent = "-";
}

function metadataEls() {
    return {
        placeholder: document.getElementById("metadataPlaceholder"),
        form: document.getElementById("metadataForm"),
        info: document.getElementById("metadataFileInfo"),
        status: document.getElementById("metadataStatus"),
        title: document.getElementById("metaTitle"),
        author: document.getElementById("metaAuthor"),
        subject: document.getElementById("metaSubject"),
        keywords: document.getElementById("metaKeywords"),
        creator: document.getElementById("metaCreator"),
        producer: document.getElementById("metaProducer"),
    };
}

function clearMetadataTool(message) {
    if (!message) message = t("metadataPlaceholder");
    const els = metadataEls();
    els.placeholder.classList.remove("hidden");
    els.placeholder.innerHTML = `<p>${escapeHtml(message)}</p>`;
    els.form.classList.add("hidden");
    ["title", "author", "subject", "keywords", "creator", "producer"].forEach((key) => {
        els[key].value = "";
    });
    els.info.textContent = "";
    els.status.textContent = "";
    els.status.className = "metadata-status";
}

async function loadPdfMetadata() {
    if (PF.selectedType !== "pdf") {
        clearMetadataTool();
        return;
    }
    const els = metadataEls();
    els.placeholder.classList.remove("hidden");
    els.placeholder.innerHTML = `<p>${t("metadata.loading")}</p>`;
    els.form.classList.add("hidden");
    try {
        const data = await api("pdf-metadata", {
            folder: PF.currentPath,
            file: PF.selectedPath,
        });
        if (data.error) {
            clearMetadataTool(data.error);
            return;
        }
        els.title.value = data.title || "";
        els.author.value = data.author || "";
        els.subject.value = data.subject || "";
        els.keywords.value = data.keywords || "";
        els.creator.value = data.creator || "";
        els.producer.value = data.producer || "";
        els.info.textContent = `${data.name} · ${data.pages} ${t("metadata.pages")}`;
        els.status.textContent = "";
        els.status.className = "metadata-status";
        els.placeholder.classList.add("hidden");
        els.form.classList.remove("hidden");
    } catch (e) {
        clearMetadataTool(`${t("metadata.readError")} ${e.message}`);
    }
}

async function savePdfMetadata() {
    if (PF.isRunning) return;
    if (PF.selectedType !== "pdf") return alert(t("alert.selectPdf"));
    const els = metadataEls();
    setButtonsDisabled(true);
    els.status.textContent = t("metadata.saving");
    els.status.className = "metadata-status";
    log("\n=== 开始保存 PDF 元数据 ===\n");
    const success = await apiStream("pdf-metadata-save", {
        folder: PF.currentPath,
        file: PF.selectedPath,
        metadata: {
            title: els.title.value,
            author: els.author.value,
            subject: els.subject.value,
            keywords: els.keywords.value,
            creator: els.creator.value,
            producer: els.producer.value,
        },
    }, (line, replace) => log(line, replace));
    log(success ? "\n=== 元数据保存完成 ===\n" : "\n=== 元数据保存失败 ===\n");
    setButtonsDisabled(false);
    if (success) {
        await loadPdfMetadata();
        els.status.textContent = t("metadata.saved");
        els.status.className = "metadata-status success";
        if (document.querySelector("#pdfPage .tab.active")?.dataset.tab === "preview") {
            showPdfPreview(PF.selectedPath);
        }
    } else {
        els.status.textContent = t("metadata.saveFailed");
        els.status.className = "metadata-status error";
    }
}
