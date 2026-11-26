import sharp from 'sharp'

/** Keep the source untouched if it is not a decodable raster image. */
export async function encodeWebpImage(source: Uint8Array): Promise<Buffer> {
  return sharp(source, { animated: true, limitInputPixels: 40_000_000 })
    .rotate()
    .webp({ quality: 84, effort: 4 })
    .toBuffer()
}
