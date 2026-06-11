import tempfile
import unittest
from pathlib import Path

from PIL import Image

from pixelforge_core.image import image_compress, image_convert, image_crop, image_merge, image_resize


class ImageOpsTests(unittest.TestCase):
    def test_image_operations_write_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            Image.new("RGB", (40, 30), "red").save(root / "1.png")
            Image.new("RGB", (30, 40), "blue").save(root / "2.jpg")

            resized = image_resize(root, "1.png", 20, 10)
            resized_percent = image_resize(root, "1.png", 50, 200, mode="percent")
            merged = image_merge(root, "grid", border=True)
            cropped = image_crop(root, "1.png", {"x": 0.1, "y": 0.1, "width": 0.5, "height": 0.5})
            converted = image_convert(root, "1.png", "webp")
            compressed = image_compress(root, "2.jpg", quality=60, max_side=20)

            with Image.open(resized_percent.outputs[0]) as image:
                self.assertEqual(image.size, (20, 60))

            for result in (resized, resized_percent, merged, cropped, converted, compressed):
                self.assertEqual(result.failed, 0)
                self.assertTrue(result.outputs)
                for output in result.outputs:
                    self.assertTrue(output.exists(), output)

    def test_batch_skip_corrupted_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            Image.new("RGB", (40, 30), "red").save(root / "good1.png")
            Image.new("RGB", (30, 40), "blue").save(root / "good2.png")
            (root / "corrupted.png").write_bytes(b"not a real image data blablabla")
            (root / "empty.jpg").write_bytes(b"")

            merged = image_merge(root)
            self.assertEqual(merged.total, 4)
            self.assertEqual(merged.success, 2)
            self.assertEqual(len(merged.corrupted), 2)
            self.assertTrue(merged.outputs)

            converted = image_convert(root, target_format="webp")
            self.assertEqual(converted.total, 4)
            self.assertEqual(converted.success, 2)
            self.assertEqual(len(converted.corrupted), 2)
            self.assertEqual(len(converted.outputs), 2)

            compressed = image_compress(root, quality=50)
            self.assertEqual(compressed.success, 2)
            self.assertEqual(len(compressed.corrupted), 2)

    def test_all_files_corrupted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "bad1.png").write_bytes(b"garbage")
            (root / "bad2.jpg").write_bytes(b"also garbage")

            merged = image_merge(root)
            self.assertEqual(merged.total, 2)
            self.assertEqual(merged.success, 0)
            self.assertEqual(len(merged.corrupted), 2)
            self.assertFalse(merged.outputs)


if __name__ == "__main__":
    unittest.main()
