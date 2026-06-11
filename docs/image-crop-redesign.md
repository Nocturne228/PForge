# Image Crop Redesign Notes

## Existing Behavior Before Rebuild

- The image crop tool is an image-mode tab labeled `图片截取` / `Crop`.
- It operates on the currently selected image from the directory browser.
- The backend API is `POST /api/image-crop` with `folder`, `file`, and a normalized `crop` rectangle.
- The crop rectangle uses `{ "x": 0..1, "y": 0..1, "width": 0..1, "height": 0..1 }`.
- The core image operation writes a PNG into `output_images` by default and accepts an optional output path.
- The UI supports a draggable crop rectangle, resize handles, fixed ratio presets, preview zoom, and saving the selected crop as PNG.

## Problems In The Removed Frontend Design

- Crop owned a separate preview subtree and loading flow instead of sharing the normal image preview state.
- Crop state duplicated selected-image dimensions, preview image source, zoom state, and visibility decisions already needed by the image tools.
- Crop-specific CSS defined a second stage/placeholder style, which made the preview feel different from resize/convert/compress.
- Selection, drag, resize, and zoom math was scattered across many crop-specific functions.
- Browser selection events eagerly loaded both resize preview and crop preview, even when crop was not the active tool.

## Rebuild Constraints

- Keep the existing backend API and core normalized crop contract.
- Reuse the same image preview frame, selected-image loading, dimensions, and empty state as the other image tools.
- Keep crop-specific code limited to the overlay behavior and the crop command payload.
- Use shared segmented-control and tab helpers for control activation.
- Match the visual style of the existing image tool panels and preview area.
