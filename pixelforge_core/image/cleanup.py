from pixelforge_core.config import OUTPUT_DIR_IMAGES
from pixelforge_core.utils import clean_dirs_by_name


def clean_image_outputs(folder_path):
    return clean_dirs_by_name(folder_path, OUTPUT_DIR_IMAGES)
