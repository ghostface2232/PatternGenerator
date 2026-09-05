// The DOM half of the image controllers: turning a file the user dropped into
// something the document can hold, and turning what the document holds back into
// the brightness map `fields/controllers.js` samples.
//
// Everything here needs `document` and `Image`, which is exactly why the sampling
// maths lives in `fields/image-map.js` instead — that half is covered by
// `node --test`, this half by the Playwright suite.
import { useEffect, useRef, useState } from "react";
import { IMAGE_MAP_SIZE, createImageMap, luminance } from "../fields/image-map.js";

const EMPTY = {};

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the image could not be decoded"));
    img.src = src;
  });
}

// Fit inside IMAGE_MAP_SIZE without changing the aspect ratio, and never scale
// a small image up: a 40×30 thumbnail should stay 40×30 rather than become a
// blurry 192×144 that is four times the size for no extra detail.
function fitted(width, height) {
  const scale = Math.min(1, IMAGE_MAP_SIZE / Math.max(width, height));
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) };
}

function drawToCanvas(img, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // On white, so a transparent PNG reads as paper rather than as black — the
  // channel would otherwise jump wherever the alpha does.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx };
}

// A file the user picked → the asset a document stores. The picture is
// downsampled and flattened to grey before it is encoded, because that is all
// the field ever reads: a 4000×3000 photo becomes ~30 KB of PNG instead of
// several megabytes, which is what makes autosaving it to localStorage sane.
export async function readImageFile(file) {
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("the file could not be read"));
    reader.readAsDataURL(file);
  });
  const img = await loadImageElement(source);
  const { w, h } = fitted(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const { canvas, ctx } = drawToCanvas(img, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  const { data } = pixels;
  for (let i = 0; i < data.length; i += 4) {
    const grey = Math.round(luminance(data[i], data[i + 1], data[i + 2]) * 255);
    data[i] = data[i + 1] = data[i + 2] = grey;
    data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return {
    name: String(file.name || "image").slice(0, 60),
    dataURL: canvas.toDataURL("image/png"),
    width: w,
    height: h,
  };
}

async function decodeAsset(asset) {
  const img = await loadImageElement(asset.dataURL);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const { ctx } = drawToCanvas(img, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const values = new Float32Array(w * h);
  for (let i = 0; i < values.length; i++) values[i] = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  return { map: createImageMap(w, h, values), image: img };
}

// Decode every asset the document carries, once each. Keyed by the data URL, so
// renaming a controller, moving its rectangle or reloading the same picture is
// free — only genuinely new bytes are decoded, and the maps object keeps its
// identity so the pipeline memos do not re-run.
export function useImageMaps(assets) {
  const [decoded, setDecoded] = useState(EMPTY);
  const cache = useRef(new Map()); // dataURL → { map, image }

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(assets || {});
    // No early return for the empty case: Promise.all([]) still settles in a
    // microtask, so the one path below covers it without a synchronous setState
    // (which would cascade a render out of the effect body).
    Promise.all(
      entries.map(async ([id, asset]) => {
        const hit = cache.current.get(asset.dataURL);
        if (hit) return [id, hit];
        try {
          const result = await decodeAsset(asset);
          if (result.map) cache.current.set(asset.dataURL, result);
          return [id, result.map ? result : null];
        } catch (err) {
          console.warn(`Could not decode the image for ${id}:`, err);
          return [id, null];
        }
      })
    ).then(pairs => {
      if (cancelled) return;
      // Forget bytes no controller points at any more, so replacing an image ten
      // times does not keep ten bitmaps alive for the rest of the session.
      const live = new Set(entries.map(([, asset]) => asset.dataURL));
      for (const key of [...cache.current.keys()]) if (!live.has(key)) cache.current.delete(key);
      setDecoded(current => {
        const decodedPairs = pairs.filter(([, value]) => value);
        if (!decodedPairs.length) return Object.keys(current).length ? EMPTY : current;
        const next = Object.fromEntries(decodedPairs);
        const keys = Object.keys(next);
        const same = keys.length === Object.keys(current).length && keys.every(k => current[k] === next[k]);
        return same ? current : next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [assets]);

  return decoded;
}

// Split the decode result into the two shapes its consumers want: the pipeline
// samples `maps`, the canvas draws `images`.
//
// `assets` narrows the result to what the document loaded RIGHT NOW refers to.
// Decoding is asynchronous and asset ids are per-document counters, so between
// opening one document and the next one's picture finishing, an id like
// "asset-1" would otherwise still resolve to the outgoing document's bitmap and
// the new pattern would render against the wrong photograph for a frame or two.
export function splitImageMaps(decoded, assets = null) {
  const maps = {};
  const images = {};
  for (const [id, value] of Object.entries(decoded)) {
    if (assets && !(id in assets)) continue;
    maps[id] = value.map;
    images[id] = value.image;
  }
  return { maps, images };
}
