import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from pixelforge_core.config import BACKUP_DIR_PAGE_OPS, BACKUP_DIR_RESIZE
from pixelforge_core.pdf.page_ops import (
    _delete_pdf_pages,
    delete_file,
    extract_pdf,
    get_pdf_metadata,
    update_pdf_metadata,
)
from pixelforge_core.pdf.resize import _resize_single_pdf, resize_file
from pixelforge_core.utils import OperationResult, batch_with_backup


def create_test_pdf(path, page_count=5):
    writer = PdfWriter()
    for i in range(page_count):
        writer.add_blank_page(width=595, height=842)
    with open(path, "wb") as f:
        writer.write(f)


def count_pages(path):
    return len(PdfReader(path).pages)


class PageDeleteTests(unittest.TestCase):
    def test_delete_single_page_from_front(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 5)
            out = Path(tmp) / "out.pdf"
            self.assertTrue(_delete_pdf_pages(pdf, out, single=1))
            self.assertEqual(count_pages(out), 4)

    def test_delete_single_page_from_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 5)
            out = Path(tmp) / "out.pdf"
            self.assertTrue(_delete_pdf_pages(pdf, out, single=1, from_back=True))
            self.assertEqual(count_pages(out), 4)

    def test_delete_first_n_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 5)
            out = Path(tmp) / "out.pdf"
            self.assertTrue(_delete_pdf_pages(pdf, out, range_count=2))
            self.assertEqual(count_pages(out), 3)

    def test_delete_last_n_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 5)
            out = Path(tmp) / "out.pdf"
            self.assertTrue(_delete_pdf_pages(pdf, out, range_count=2, from_back=True))
            self.assertEqual(count_pages(out), 3)

    def test_delete_page_range(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 5)
            out = Path(tmp) / "out.pdf"
            self.assertTrue(_delete_pdf_pages(pdf, out, range_start=2, range_end=4))
            self.assertEqual(count_pages(out), 2)

    def test_delete_refuses_to_clear_all_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 3)
            out = Path(tmp) / "out.pdf"
            self.assertFalse(_delete_pdf_pages(pdf, out, range_count=3))

    def test_delete_invalid_page_number(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 3)
            out = Path(tmp) / "out.pdf"
            self.assertFalse(_delete_pdf_pages(pdf, out, single=10))


class BackupBehaviorTests(unittest.TestCase):
    def test_delete_with_backup_creates_backup_and_processes(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 5)
            result = delete_file(str(tmp), str(pdf), single=1)
            self.assertEqual(result.success, 1)
            self.assertEqual(count_pages(pdf), 4)
            backup = Path(tmp) / BACKUP_DIR_PAGE_OPS / "test.pdf"
            self.assertTrue(backup.exists())
            self.assertEqual(count_pages(backup), 5)

    def test_skip_when_backup_already_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 5)
            backup_dir = Path(tmp) / BACKUP_DIR_PAGE_OPS
            backup_dir.mkdir()
            create_test_pdf(backup_dir / "test.pdf", 5)
            result = delete_file(str(tmp), str(pdf), single=1)
            self.assertEqual(result.skipped, 1)
            self.assertEqual(result.success, 0)
            self.assertEqual(count_pages(pdf), 5)

    def test_resize_with_backup_creates_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 3)
            result = resize_file(str(tmp), str(pdf), 210, 297)
            self.assertEqual(result.success, 1)
            backup = Path(tmp) / BACKUP_DIR_RESIZE / "test.pdf"
            self.assertTrue(backup.exists())


class ExtractTests(unittest.TestCase):
    def test_extract_page_range(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 10)
            output = extract_pdf(str(tmp), str(pdf), 3, 7)
            self.assertTrue(output.exists())
            self.assertEqual(count_pages(output), 5)

    def test_extract_single_page_range(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 5)
            output = extract_pdf(str(tmp), str(pdf), 2, 2)
            self.assertEqual(count_pages(output), 1)


class MetadataTests(unittest.TestCase):
    def test_read_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            create_test_pdf(pdf, 3)
            meta = get_pdf_metadata(str(tmp), str(pdf))
            self.assertEqual(meta["pages"], 3)
            self.assertEqual(meta["name"], "test.pdf")

    def test_write_and_read_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = Path(tmp) / "test.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=595, height=842)
            with open(pdf, "wb") as f:
                writer.write(f)

            result = update_pdf_metadata(str(tmp), str(pdf), {
                "title": "Test Title",
                "author": "Test Author",
            })
            self.assertEqual(result.success, 1)

            meta = get_pdf_metadata(str(tmp), str(pdf))
            self.assertEqual(meta["title"], "Test Title")
            self.assertEqual(meta["author"], "Test Author")
            self.assertEqual(meta["pages"], 1)


class BatchWithBackupTests(unittest.TestCase):
    def test_successful_processing(self):
        with tempfile.TemporaryDirectory() as tmp:
            f1 = Path(tmp) / "a.pdf"
            f2 = Path(tmp) / "b.pdf"
            create_test_pdf(f1, 3)
            create_test_pdf(f2, 5)

            def process(input_path, output_path):
                input_path.rename(output_path)
                return True

            result = batch_with_backup([f1, f2], "backup_test", process)
            self.assertEqual(result.total, 2)
            self.assertEqual(result.success, 2)
            self.assertEqual(result.failed, 0)
            self.assertTrue(f1.exists())
            self.assertTrue(f2.exists())

    def test_failed_processing_triggers_rollback(self):
        with tempfile.TemporaryDirectory() as tmp:
            f1 = Path(tmp) / "a.pdf"
            create_test_pdf(f1, 3)

            def process(input_path, output_path):
                return False

            result = batch_with_backup([f1], "backup_test", process)
            self.assertEqual(result.total, 1)
            self.assertEqual(result.failed, 1)
            self.assertEqual(result.success, 0)
            self.assertTrue(f1.exists())
            self.assertFalse((Path(tmp) / "backup_test" / "a.pdf").exists())

    def test_exception_in_processing_triggers_rollback(self):
        with tempfile.TemporaryDirectory() as tmp:
            f1 = Path(tmp) / "a.pdf"
            create_test_pdf(f1, 3)

            def process(input_path, output_path):
                raise RuntimeError("boom")

            result = batch_with_backup([f1], "backup_test", process)
            self.assertEqual(result.failed, 1)
            self.assertTrue(f1.exists())

    def test_skip_when_backup_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            f1 = Path(tmp) / "a.pdf"
            create_test_pdf(f1, 3)
            backup_dir = Path(tmp) / "backup_test"
            backup_dir.mkdir()
            create_test_pdf(backup_dir / "a.pdf", 3)

            result = batch_with_backup([f1], "backup_test", lambda i, o: True)
            self.assertEqual(result.skipped, 1)
            self.assertEqual(result.success, 0)

    def test_empty_file_list(self):
        result = batch_with_backup([], "backup_test", lambda i, o: True)
        self.assertEqual(result.total, 0)

    def test_mixed_success_and_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            f1 = Path(tmp) / "a.pdf"
            f2 = Path(tmp) / "b.pdf"
            create_test_pdf(f1, 3)
            create_test_pdf(f2, 5)

            call_count = [0]

            def process(input_path, output_path):
                call_count[0] += 1
                return call_count[0] % 2 == 1

            result = batch_with_backup([f1, f2], "backup_test", process)
            self.assertEqual(result.success, 1)
            self.assertEqual(result.failed, 1)


if __name__ == "__main__":
    unittest.main()
