// =====================================================
// PDF Preview & Metadata
// =====================================================

function switchToTab(tabName) {
    const pdfPage = document.getElementById("pdfPage");
    if (!pdfPage) return;

    pdfPage.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    pdfPage.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    const tabBtn = pdfPage.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add("active");
    const panel = pdfPage.querySelector("#panel-" + tabName);
    if (panel) panel.classList.add("active");

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

    imagePage.querySelectorAll(".tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.imageTab === tabName);
    });
    imagePage.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `image-panel-${tabName}`);
    });

    const selectedImage = isSelectedImage();
    document.getElementById("imageCropPreview").classList.toggle("hidden", tabName !== "crop" || !selectedImage);
    document.getElementById("imagePreviewFrame").classList.toggle("hidden", tabName === "crop" || !selectedImage);
    document.getElementById("imagePreviewEmpty").classList.toggle("hidden", selectedImage);
    if (tabName === "crop") {
        ensureImageCropLoaded();
    }
}

async function showPdfPreview(filePath) {
    const placeholder = document.getElementById("previewPlaceholder");
    const container = document.getElementById("previewContainer");
    const frame = document.getElementById("previewFrame");
    const info = document.getElementById("previewInfo");
    const name = document.getElementById("pdfPreviewName");
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

        name.textContent = data.name || t("pdfPreviewName.selected");
        dims.textContent = `${data.pages} ${t("preview.pages")} · ${data.width_mm} x ${data.height_mm} mm · ${formatSize(data.size)}`;

        info.innerHTML = `
            <span class="info-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span class="info-label">${escapeHtml(data.name)}</span></span>
            <span class="info-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>页数 <span class="info-label">${data.pages}</span></span>
            <span class="info-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg><span class="info-label">${data.width_mm} x ${data.height_mm} mm</span></span>
            <span class="info-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span class="info-label">${formatSize(data.size)}</span></span>
        `;

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
    const name = document.getElementById("pdfPreviewName");
    const dims = document.getElementById("pdfPreviewDims");

    placeholder.classList.remove("hidden");
    placeholder.innerHTML = `<p>${t("previewPlaceholder")}</p>`;
    container.classList.add("hidden");
    frame.src = "";
    name.textContent = t("pdfPreviewName");
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
    if (selectedType !== "pdf") {
        clearMetadataTool();
        return;
    }
    const els = metadataEls();
    els.placeholder.classList.remove("hidden");
    els.placeholder.innerHTML = `<p>${t("metadata.loading")}</p>`;
    els.form.classList.add("hidden");
    try {
        const data = await api("pdf-metadata", {
            folder: currentPath,
            file: selectedPath,
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
    if (isRunning) return;
    if (selectedType !== "pdf") return alert(t("alert.selectPdf"));
    const els = metadataEls();
    setButtonsDisabled(true);
    els.status.textContent = t("metadata.saving");
    els.status.className = "metadata-status";
    log("\n=== 开始保存 PDF 元数据 ===\n");
    const success = await apiStream("pdf-metadata-save", {
        folder: currentPath,
        file: selectedPath,
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
            showPdfPreview(selectedPath);
        }
    } else {
        els.status.textContent = t("metadata.saveFailed");
        els.status.className = "metadata-status error";
    }
}
