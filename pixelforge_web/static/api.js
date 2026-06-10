// =====================================================
// API Helpers & Logging
// =====================================================

function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizePath(path) {
    let value = String(path == null ? "" : path).replace(/\\/g, "/");
    if (value === "/" || value === "") return value;
    if (/^[A-Za-z]:$/.test(value)) return value + "/";
    return value.replace(/\/+$/, "");
}

function classifyLogLine(msg) {
    const text = String(msg).trim();
    if (!text) return { type: "blank", icon: "" };
    if (/^=+$/.test(text)) return { type: "divider", icon: "" };
    if (text.includes("报告") || text.includes("文件总数") || text.includes("成功转换") ||
        text.includes("成功处理") || text.includes("处理失败") || text.includes("安全跳过")) {
        return { type: "summary", icon: "#" };
    }
    if (text.includes("[错误]") || text.includes("转换失败") || text.includes("删除失败") ||
        text.includes("缩放失败") || text.includes("提取失败") || text.includes("无效") || text.includes("超时")) {
        return { type: "error", icon: "!" };
    }
    if (text.includes("[跳过]") || text.includes("跳过") || text.includes("警告")) {
        return { type: "warning", icon: "!" };
    }
    if (text.includes("进度")) {
        return { type: "progress", icon: "%" };
    }
    if (text.includes("完成") || text.includes("成功") || text.includes("已保存") || text.includes("已打开")) {
        return { type: "success", icon: "OK" };
    }
    if (text.includes("开始") || text.includes("正在")) {
        return { type: "active", icon: ">" };
    }
    if (text.includes("扫描目录") || text.includes("指定文件") || text.includes("处理:") || text.includes("输出 DPI")) {
        return { type: "path", icon: "@" };
    }
    return { type: "info", icon: "i" };
}

function createLogLine(msg) {
    const meta = classifyLogLine(msg);
    const line = document.createElement("div");
    line.className = `log-line log-line-${meta.type}`;

    if (meta.type !== "blank" && meta.type !== "divider") {
        const icon = document.createElement("span");
        icon.className = "log-icon";
        icon.textContent = meta.icon;
        line.appendChild(icon);
    }

    const message = document.createElement("span");
    message.className = "log-message";
    message.textContent = meta.type === "divider" ? "" : msg;
    line.appendChild(message);
    return line;
}

function replaceLastLogLine(el, msg) {
    const replacement = createLogLine(msg);
    const last = el.lastElementChild;
    if (last) {
        el.replaceChild(replacement, last);
    } else {
        el.appendChild(replacement);
    }
}

function log(msg, replace = false) {
    const el = document.getElementById("logOutput");
    if (replace && el.dataset.replaceActive === "1") {
        replaceLastLogLine(el, msg);
    } else {
        const lines = String(msg).split("\n");
        for (const line of lines) {
            el.appendChild(createLogLine(line));
        }
    }
    el.dataset.replaceActive = replace ? "1" : "0";
    el.scrollTop = el.scrollHeight;
}

function clearLog() {
    const el = document.getElementById("logOutput");
    el.replaceChildren(createLogLine(t("log.waiting")));
    el.dataset.replaceActive = "0";
}

async function api(endpoint, data) {
    const resp = await fetch("/api/" + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return resp.json();
}

async function apiStream(endpoint, data, onLine) {
    let resp;
    try {
        resp = await fetch("/api/" + endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    } catch (e) {
        onLine(`[错误] 请求失败: ${e.message}`);
        return false;
    }

    if (!resp.ok) {
        let message = resp.statusText;
        try {
            const err = await resp.json();
            message = err.error || message;
        } catch (_) {}
        onLine(`[错误] ${message}`);
        return false;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let success = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
                const evt = JSON.parse(line.slice(6));
                if (evt.done) {
                    success = evt.success;
                } else if (evt.line !== undefined) {
                    onLine(evt.line, Boolean(evt.replace));
                }
            } catch (_) {}
        }
    }

    return success;
}

function fileIcon(ext) {
    const icons = {
        ".pdf": "📄",
        ".zip": "📦",
        ".png": "🖼",
        ".jpg": "🖼",
        ".jpeg": "🖼",
        ".webp": "🖼",
        ".bmp": "🖼",
        ".tif": "🖼",
        ".tiff": "🖼",
    };
    return icons[ext] || "📎";
}
