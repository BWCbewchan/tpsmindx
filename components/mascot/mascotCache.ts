/**
 * Mascot frame preloading utility.
 * Ensures each image URL is loaded only once across the app.
 */
export const mascotImageCache = new Map<string, HTMLImageElement>();

/**
 * Preload an array of image URLs.
 * Subsequent calls with the same URLs will be no‑ops.
 */
export function preloadMascotFrames(frames: string[]) {
  frames.forEach(src => {
    if (!mascotImageCache.has(src)) {
      const img = new Image();
      img.src = src;
      mascotImageCache.set(src, img);
    }
  });
}
