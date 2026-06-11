import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(path):
    return (ROOT / path).read_text(encoding="utf-8")


class FrontendContractsTests(unittest.TestCase):
    def test_split_tool_scripts_are_loaded_in_order(self):
        html = read_text("pixelforge_web/templates/index.html")
        scripts = re.findall(r'<script src="/static/([^"?]+)\?v=\d+"></script>', html)

        self.assertNotIn("image-tools.js", scripts)
        for script in [
            "actions.js",
            "pdf-tools.js",
            "image-preview.js",
            "image-crop.js",
            "image-resize.js",
            "image-batch-tools.js",
        ]:
            self.assertIn(script, scripts)

        self.assertLess(scripts.index("actions.js"), scripts.index("pdf-tools.js"))
        self.assertLess(scripts.index("image-preview.js"), scripts.index("image-crop.js"))
        self.assertLess(scripts.index("image-preview.js"), scripts.index("image-resize.js"))
        self.assertLess(scripts.index("image-preview.js"), scripts.index("image-batch-tools.js"))

    def test_crop_overlay_uses_shared_image_preview(self):
        html = read_text("pixelforge_web/templates/index.html")

        self.assertIn('id="imagePreviewFrame"', html)
        self.assertIn('id="imagePreviewCanvas"', html)
        self.assertIn('id="imageResizePreview"', html)
        self.assertIn('id="imageCropOverlay"', html)
        self.assertNotIn('id="imageCropPreview"', html)

        frame_start = html.index('id="imagePreviewFrame"')
        canvas_start = html.index('id="imagePreviewCanvas"')
        crop_start = html.index('id="imageCropOverlay"')
        resize_start = html.index('id="imageResizePreview"')
        self.assertLess(frame_start, canvas_start)
        self.assertLess(canvas_start, resize_start)
        self.assertLess(resize_start, crop_start)

    def test_crop_zoom_reset_follows_zoom_status(self):
        html = read_text("pixelforge_web/templates/index.html")
        row = re.search(r'<div class="image-crop-zoom-row">(.*?)</div>', html, re.S)

        self.assertIsNotNone(row)
        ids = re.findall(r'id="([^"]+)"', row.group(1))
        self.assertEqual(ids, ["imageCropZoom", "imageCropZoomLabel", "imageCropZoomResetBtn"])

    def test_shared_frontend_helpers_exist(self):
        app = read_text("pixelforge_web/static/app.js")
        actions = read_text("pixelforge_web/static/actions.js")

        for name in ["runToolAction", "numberValue", "intValue", "boolValue", "bindImageToolControls"]:
            self.assertIn(f"function {name}", app)

        self.assertIn("function setButtonsDisabled", actions)
        self.assertNotIn("async function doResize", actions)
        self.assertNotIn("async function doImageResize", actions)

    def test_state_encapsulated_in_pf_namespace(self):
        app = read_text("pixelforge_web/static/app.js")
        self.assertIn("var PF = {", app)

        state_vars = [
            "currentPath", "selectedPath", "selectedType", "isRunning",
            "viewMode", "lastBrowseData", "rootPath",
            "imagePreviewState", "imageCropState",
            "imageResizeOriginalWidth", "imageResizeOriginalHeight",
            "imageResizeLockRatio", "imageResizeMode",
        ]
        for var in state_vars:
            bare_pattern = re.compile(rf"(?<![.\w]){var}(?![:\w])")
            for js_file in [
                "browser.js", "pdf-tools.js", "image-preview.js",
                "image-crop.js", "image-resize.js", "image-batch-tools.js",
            ]:
                content = read_text(f"pixelforge_web/static/{js_file}")
                matches = bare_pattern.findall(content)
                self.assertEqual(
                    len(matches), 0,
                    f"{js_file} has bare '{var}' reference(s) — should use PF.{var}",
                )


if __name__ == "__main__":
    unittest.main()
