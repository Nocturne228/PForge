// =====================================================
// Directory Browser
// =====================================================

async function navigateTo(path) {
    const treeEl = document.getElementById("fileTree");
    treeEl.innerHTML = '<div class="loading">加载中...</div>';

    const data = await api("browse", { path });
    if (data.error) {
        treeEl.innerHTML = `<div class="loading">${escapeHtml(data.error)}</div>`;
        return;
    }

    currentPath = normalizePath(data.path);
    selectedPath = "";
    selectedType = "";
    updateBreadcrumb(data.path);
    updateSelectionInfo();
    clearPdfPreview();
    clearMetadataTool();
    clearImageCropTool();
    clearImageResizeInfo();

    lastBrowseData = data;
    renderFileTree(data);
}

function renderFileTree(data) {
    const treeEl = document.getElementById("fileTree");

    treeEl.classList.toggle("card-view", viewMode === "card");

    let html = "";

    const curNorm = normalizePath(data.path);
    const rootNorm = normalizePath(rootPath);
    let parentPath;
    if (isRootPath(data.path) || curNorm === "/" || curNorm === "") {
        parentPath = curNorm;
    } else if (/^[A-Za-z]:\/?$/.test(curNorm)) {
        parentPath = curNorm;
    } else {
        const lastSlash = curNorm.lastIndexOf("/");
        if (lastSlash <= 0) {
            parentPath = curNorm[0] === "/" ? "/" : rootNorm;
        } else {
            const parent = curNorm.slice(0, lastSlash);
            if (/^[A-Za-z]:$/.test(parent)) {
                parentPath = parent + "/";
            } else {
                parentPath = parent;
            }
        }
    }

    if (viewMode === "card") {
        if (!isRootPath(data.path) && data.path !== "/" && data.path.length > 1) {
            html += `<div class="card-item parent-dir" data-path="${escapeHtml(parentPath)}" data-type="dir">
                <div class="card-thumb"><span class="card-icon">⬆</span></div>
                <div class="card-info"><div class="card-name">..</div></div>
            </div>`;
        }

        for (const d of data.dirs) {
            html += `<div class="card-item card-dir" data-path="${escapeHtml(d.path)}" data-type="dir">
                <div class="card-thumb"><span class="card-icon">📁</span></div>
                <div class="card-info"><div class="card-name">${escapeHtml(d.name)}</div></div>
            </div>`;
        }

        for (const f of data.files) {
            const ext = f.ext;
            const type = fileTypeFromExt(ext);
            let thumbHtml;
            if (type === "pdf") {
                thumbHtml = `<div class="card-thumb ratio-a4"><img src="/api/page-image?path=${encodeURIComponent(f.path)}&page=1&dpi=72" alt=""></div>`;
            } else if (type === "image") {
                thumbHtml = `<div class="card-thumb ratio-auto"><img src="/api/image-file?path=${encodeURIComponent(f.path)}" alt=""></div>`;
            } else {
                const icon = fileIcon(ext);
                thumbHtml = `<div class="card-thumb ratio-square"><span class="card-icon">${icon}</span></div>`;
            }
            html += `<div class="card-item" data-path="${escapeHtml(f.path)}" data-type="${type}">
                ${thumbHtml}
                <div class="card-info">
                    <div class="card-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
                    <div class="card-meta">${formatSize(f.size)}</div>
                </div>
            </div>`;
        }
    } else {
        if (!isRootPath(data.path) && data.path !== "/" && data.path.length > 1) {
            html += `<div class="tree-item parent-dir" data-path="${escapeHtml(parentPath)}" data-type="dir">
                <span class="icon">⬆</span>
                <span class="name">..</span>
            </div>`;
        }

        for (const d of data.dirs) {
            html += `<div class="tree-item" data-path="${escapeHtml(d.path)}" data-type="dir">
                <span class="icon">📁</span>
                <span class="name">${escapeHtml(d.name)}</span>
            </div>`;
        }

        for (const f of data.files) {
            const ext = f.ext;
            const icon = fileIcon(ext);
            const type = fileTypeFromExt(ext);
            html += `<div class="tree-item" data-path="${escapeHtml(f.path)}" data-type="${type}">
                <span class="icon">${icon}</span>
                <span class="name">${escapeHtml(f.name)}</span>
                <span class="size">${formatSize(f.size)}</span>
            </div>`;
        }
    }

    if (!html) {
        html = '<div class="loading">空目录</div>';
    }

    treeEl.innerHTML = html;

    const itemSelector = viewMode === "card" ? ".card-item" : ".tree-item";

    treeEl.querySelectorAll(itemSelector).forEach((item) => {
        item.addEventListener("click", () => {
            const type = item.dataset.type;
            const path = item.dataset.path;

            if (type === "dir") {
                navigateTo(path);
            } else {
                treeEl.querySelectorAll(itemSelector).forEach((i) => i.classList.remove("selected"));
                item.classList.add("selected");
                selectedPath = normalizePath(path);
                selectedType = type;
                updateSelectionInfo();
                if (type === "image") {
                    loadImageInfoForResize();
                } else {
                    clearImageCropTool();
                    clearImageResizeInfo();
                }

                if (type === "pdf") {
                    showPdfPreview(path);
                    if (document.querySelector("#pdfPage .tab.active")?.dataset.tab === "metadata") {
                        loadPdfMetadata();
                    }
                } else {
                    clearPdfPreview();
                    clearMetadataTool();
                }
            }
        });

        item.addEventListener("dblclick", () => {
            if (item.dataset.type === "dir") {
                navigateTo(item.dataset.path);
            }
        });
    });
}

function toggleViewMode() {
    viewMode = viewMode === "list" ? "card" : "list";
    const btn = document.getElementById("viewToggleBtn");
    btn.classList.toggle("active", viewMode === "card");
    document.querySelector(".sidebar").classList.toggle("card-mode", viewMode === "card");
    if (lastBrowseData) {
        renderFileTree(lastBrowseData);
    }
}

function updateBreadcrumb(path) {
    const el = document.getElementById("breadcrumb");
    const normalizedRoot = normalizePath(rootPath);
    const normalizedPath = normalizePath(path);
    let html = `<span data-path="${escapeHtml(rootPath)}">${t("breadcrumb.root")}</span>`;
    let parts = [];

    if (normalizedPath !== normalizedRoot && normalizedRoot === "/") {
        parts = normalizedPath.split("/").filter(Boolean);
    } else if (normalizedPath !== normalizedRoot && normalizedPath.startsWith(`${normalizedRoot}/`)) {
        parts = normalizedPath.slice(normalizedRoot.length + 1).split("/").filter(Boolean);
    } else if (normalizedPath !== normalizedRoot) {
        parts = [normalizedPath.split("/").filter(Boolean).pop() || normalizedPath];
    }

    let accumulated = normalizedRoot === "/" ? "" : normalizedRoot;
    for (const part of parts) {
        accumulated = `${accumulated}/${part}`;
        html += `<span data-path="${escapeHtml(accumulated)}">${escapeHtml(part)}</span>`;
    }

    el.innerHTML = html;
    el.querySelectorAll("span").forEach((span) => {
        span.addEventListener("click", () => navigateTo(span.dataset.path));
    });
}

function relativePath(fullPath) {
    const root = normalizePath(rootPath);
    const path = normalizePath(fullPath);
    if (path === root) return "/";
    if (path.startsWith(root + "/")) return path.slice(root.length + 1);
    return path.split("/").pop() || path;
}

function updateSelectionInfo() {
    const el = document.getElementById("selectionInfo");
    if (!selectedPath) {
        el.innerHTML = `<p>${t("selectionInfo")}</p>
            <div class="path">${escapeHtml(relativePath(currentPath))}</div>`;
        return;
    }

    const typeLabel = {
        dir: t("selectionInfo.dir"),
        pdf: t("selectionInfo.pdf"),
        zip: t("selectionInfo.zip"),
        image: t("selectionInfo.image"),
        other: t("selectionInfo.other"),
    };

    el.innerHTML = `<p>${t("selectionInfo.selected")}<strong>${typeLabel[selectedType] || t("selectionInfo.other")}</strong></p>
        <div class="path">${escapeHtml(relativePath(selectedPath))}</div>`;
}

async function scanDirectory() {
    const path = currentPath;
    if (!path) return;

    log(`\n--- 扫描目录: ${path} ---\n`);
    const data = await api("scan", { path });
    if (data.error) {
        log(`[错误] ${data.error}\n`);
        return;
    }

    log(`PDF 文件: ${data.pdfs.length} 个`);
    for (const p of data.pdfs) {
        log(`  ${p.rel}`);
    }
    log(`\nZIP 文件: ${data.zips.length} 个`);
    for (const z of data.zips) {
        log(`  ${z.rel}`);
    }
    if (data.truncated) {
        log(`\n[跳过] 扫描结果超过 ${data.limit} 条，已截断显示。`);
    }
    log("\n扫描完成。\n");
}

async function refreshDirectory() {
    if (!currentPath) return;
    await navigateTo(currentPath);
    log(`刷新目录: ${currentPath}`);
}
