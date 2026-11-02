"use client";

import * as React from "react";
import { ImageOff, Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Slider } from "./slider";

/** Side length (px) of the square JPEG produced for the avatar. */
export const AVATAR_OUTPUT_SIZE = 512;

/**
 * On-screen size of the square editor, in CSS px. Chosen so the dialog still
 * fits a 320px-wide phone: the dialog shell is `max-w-[calc(100%-2rem)]`, which
 * leaves exactly 288px, so the canvas never has to be scaled — the pointer
 * deltas the user drags are the same units the crop math uses.
 */
const VIEWPORT = 288;

const MIN_ZOOM = 1; // 1 = the photo just covers the square (no empty corners)
const MAX_ZOOM = 4;

type Offset = { x: number; y: number };

/**
 * The visible crop, derived in ONE place so the preview and the exported pixels
 * can never disagree:
 *
 *  - `base` is the smallest scale at which the photo still covers the square,
 *    and `scale` multiplies it by the user's zoom.
 *  - `offset` is the top-left of the drawn photo relative to the frame, in CSS
 *    px, and is always clamped so the frame stays fully covered.
 *  - `renderCrop` maps the frame back through `scale` to get the source rect,
 *    which is the exact region the user is looking at.
 */
function geometry(image: HTMLImageElement, zoom: number) {
  const base = Math.max(VIEWPORT / image.naturalWidth, VIEWPORT / image.naturalHeight);
  const scale = base * zoom;
  return { scale, width: image.naturalWidth * scale, height: image.naturalHeight * scale };
}

function clampOffset(offset: Offset, width: number, height: number): Offset {
  // `width`/`height` are always >= VIEWPORT, so each range is valid (min <= max).
  return {
    x: Math.min(0, Math.max(VIEWPORT - width, offset.x)),
    y: Math.min(0, Math.max(VIEWPORT - height, offset.y)),
  };
}

function centeredOffset(width: number, height: number): Offset {
  return { x: (VIEWPORT - width) / 2, y: (VIEWPORT - height) / 2 };
}

export interface AvatarCropDialogProps {
  open: boolean;
  /** The picture the user just picked, as a data URL. */
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  /** Receives a square JPEG data URL, `AVATAR_OUTPUT_SIZE` × `AVATAR_OUTPUT_SIZE`. */
  onApply: (croppedDataUrl: string) => void;
}

/**
 * Small photo editor shown right after an avatar file is picked: drag to
 * reposition, zoom until the face fills the circle, then "Use photo".
 *
 * Only the square inside the frame is kept, and it is re-drawn at
 * `AVATAR_OUTPUT_SIZE` on export, so a 12MP phone photo ends up as a ~60KB
 * square JPEG instead of a giant upload. Everything is canvas — no cropper
 * library, and no server round-trip.
 */
export function AvatarCropDialog({ open, imageSrc, onOpenChange, onApply }: AvatarCropDialogProps) {
  const previewRef = React.useRef<HTMLCanvasElement | null>(null);
  const dragRef = React.useRef<
    { pointerId: number; startX: number; startY: number; origin: Offset } | null
  >(null);

  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = React.useState(MIN_ZOOM);
  const [offset, setOffset] = React.useState<Offset>({ x: 0, y: 0 });
  const [decodeFailed, setDecodeFailed] = React.useState(false);

  // Decode each picked file once, then start centred and unzoomed.
  React.useEffect(() => {
    if (!imageSrc) {
      setImage(null);
      setDecodeFailed(false);
      return;
    }

    let alive = true;
    setDecodeFailed(false);

    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      setImage(img);
      setZoom(MIN_ZOOM);
      const g = geometry(img, MIN_ZOOM);
      setOffset(centeredOffset(g.width, g.height));
    };
    img.onerror = () => {
      if (!alive) return;
      setImage(null);
      setDecodeFailed(true);
    };
    // Browsers apply EXIF orientation while decoding, so naturalWidth /
    // naturalHeight (and therefore the crop) already match what is on screen.
    img.src = imageSrc;

    return () => {
      alive = false;
    };
  }, [imageSrc]);

  // Re-opening the dialog (even with the same file) starts from the framed
  // default instead of keeping a pan from last time.
  React.useEffect(() => {
    if (!open || !image) return;
    const g = geometry(image, MIN_ZOOM);
    setZoom(MIN_ZOOM);
    setOffset(centeredOffset(g.width, g.height));
    dragRef.current = null;
  }, [open, image]);

  const draw = React.useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas || !image) return;

    // Cap the backing store at 2× so a retina phone stays sharp without
    // quadrupling the pixels painted on every drag frame.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = VIEWPORT * dpr;
    canvas.height = VIEWPORT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VIEWPORT, VIEWPORT);
    // White, not transparent: the export is a JPEG (no alpha), so anything the
    // photo leaves transparent must already look the same here.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, VIEWPORT, VIEWPORT);

    const g = geometry(image, zoom);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, offset.x, offset.y, g.width, g.height);

    // Dim everything outside the avatar circle, so the frame previews the ROUND
    // avatar rather than the whole square picture.
    const radius = VIEWPORT / 2 - 10;
    const centre = VIEWPORT / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEWPORT, VIEWPORT);
    ctx.arc(centre, centre, radius, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(15,23,42,.58)";
    ctx.fill("evenodd");
    ctx.restore();

    ctx.beginPath();
    ctx.arc(centre, centre, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [image, zoom, offset]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  // Zoom about the centre of the frame: keep the pixel under the centre fixed,
  // so zooming never throws the face out of view.
  const zoomTo = (next: number) => {
    if (!image) return;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (Math.abs(clamped - zoom) < 0.001) return;

    const before = geometry(image, zoom);
    const centreSourceX = (VIEWPORT / 2 - offset.x) / before.scale;
    const centreSourceY = (VIEWPORT / 2 - offset.y) / before.scale;
    const after = geometry(image, clamped);

    setZoom(clamped);
    setOffset(
      clampOffset(
        {
          x: VIEWPORT / 2 - centreSourceX * after.scale,
          y: VIEWPORT / 2 - centreSourceY * after.scale,
        },
        after.width,
        after.height,
      ),
    );
  };

  const reset = () => {
    if (!image) return;
    const g = geometry(image, MIN_ZOOM);
    setZoom(MIN_ZOOM);
    setOffset(centeredOffset(g.width, g.height));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: offset,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !image) return;
    const g = geometry(image, zoom);
    setOffset(
      clampOffset(
        {
          x: drag.origin.x + (e.clientX - drag.startX),
          y: drag.origin.y + (e.clientY - drag.startY),
        },
        g.width,
        g.height,
      ),
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  // Keyboard parity for the drag: arrows nudge (Shift = bigger steps), +/- zoom.
  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!image) return;
    const g = geometry(image, zoom);
    const step = e.shiftKey ? 24 : 8;

    switch (e.key) {
      case "ArrowLeft":
        setOffset(clampOffset({ x: offset.x + step, y: offset.y }, g.width, g.height));
        break;
      case "ArrowRight":
        setOffset(clampOffset({ x: offset.x - step, y: offset.y }, g.width, g.height));
        break;
      case "ArrowUp":
        setOffset(clampOffset({ x: offset.x, y: offset.y + step }, g.width, g.height));
        break;
      case "ArrowDown":
        setOffset(clampOffset({ x: offset.x, y: offset.y - step }, g.width, g.height));
        break;
      case "+":
      case "=":
        zoomTo(zoom + 0.25);
        break;
      case "-":
        zoomTo(zoom - 0.25);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const renderCrop = (): string | null => {
    if (!image) return null;
    const g = geometry(image, zoom);

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Map the frame back to source pixels and draw exactly that region.
    const sourceSize = VIEWPORT / g.scale;
    // JPEG cannot store transparency, so a transparent PNG would otherwise come
    // out with a BLACK background. Composite onto white instead.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      -offset.x / g.scale,
      -offset.y / g.scale,
      sourceSize,
      sourceSize,
      0,
      0,
      AVATAR_OUTPUT_SIZE,
      AVATAR_OUTPUT_SIZE,
    );

    // JPEG at 0.92 keeps a 512px avatar around 40–80KB; the upload helper reads
    // the mime type straight off the data URL, so it is stored as `.jpg`.
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const handleApply = () => {
    const cropped = renderCrop();
    if (cropped) onApply(cropped);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Adjust your photo</DialogTitle>
          <DialogDescription className="text-base">
            Drag to reposition and zoom until your face sits inside the circle. The square inside
            this frame is what the shop sees wherever your picture appears.
          </DialogDescription>
        </DialogHeader>

        {/* A form lets the shared dialog's Enter handler trigger the primary
            action, the same way every other dialog in the app behaves. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApply();
          }}
          className="space-y-4"
        >
          <div className="flex justify-center">
            {decodeFailed ? (
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-center ring-1 ring-slate-200"
                style={{ width: VIEWPORT, height: VIEWPORT }}
              >
                <ImageOff className="h-7 w-7 text-slate-400" />
                <p className="px-6 text-sm font-medium text-slate-600">
                  That image couldn&apos;t be opened. Please try another file.
                </p>
              </div>
            ) : (
              <canvas
                ref={previewRef}
                width={VIEWPORT}
                height={VIEWPORT}
                style={{ width: VIEWPORT, height: VIEWPORT }}
                role="img"
                aria-label="Photo crop preview. Drag to reposition, arrow keys to nudge, plus and minus to zoom."
                tabIndex={0}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onKeyDown}
                className="block cursor-grab touch-none rounded-2xl bg-slate-900 ring-1 ring-slate-200 focus-visible:ring-2 focus-visible:ring-[#1668D9] focus-visible:outline-none active:cursor-grabbing"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Zoom</span>
              <span className="text-xs font-medium tabular-nums text-slate-500">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Zoom out"
                onClick={() => zoomTo(zoom - 0.25)}
                disabled={!image || zoom <= MIN_ZOOM}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Slider
                value={[zoom]}
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                onValueChange={(next) => zoomTo(next[0] ?? zoom)}
                disabled={!image}
                aria-label="Zoom"
                aria-valuetext={`${Math.round(zoom * 100)} percent`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Zoom in"
                onClick={() => zoomTo(zoom + 0.25)}
                disabled={!image || zoom >= MAX_ZOOM}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Drag the photo to move it. Arrow keys nudge it, and the slider zooms.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto"
              onClick={reset}
              disabled={!image}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!image || decodeFailed}>
              Use photo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

