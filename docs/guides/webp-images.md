# WebP images

The web uses 665 converted public raster assets and two converted portfolio logos. Public assets decreased from 35,891,924 to 20,105,402 bytes (44%). PNG conversion is lossless, preserving real transparency and frame dimensions. JPEG conversion uses quality 84. Mascot frame lists, outfit API defaults, post placeholders and documentation image references use WebP.

`lib/public-webp-images.json` maps only generated files. Historical local image URLs returned by the application are normalized through this map, preserving query strings. Original files remain available for old stored URLs and external links. SVG stays vector; email inline logos and PWA installation icons retain PNG compatibility. Temporary screenshots outside web assets are not converted.

Storage image URLs request `format=webp` for PNG/JPEG/GIF/AVIF. The existing storage endpoint checks access before conversion, preserves animation via Sharp, and returns `image/webp` with the correct length and original public/private cache policy. Source objects and database URLs are unchanged. Files over 12 MiB, unknown lengths, undecodable raster files and certificates retain the original output. Direct third-party image URLs remain unchanged rather than inventing WebP URLs at a remote server.

Run `node scripts/convert-public-images-webp.cjs` to rebuild public WebP assets and the map. Sharp is a direct runtime dependency. For logos, create WebP siblings and update static imports. Tests: `node --test tests/webp-images.test.mjs`.

Validation: metadata of all 665 public outputs and mascot frame sequences verified; HTTP checks for post placeholder, mascot and a real honors avatar returned 200/image-webp. ESLint and six focused tests passed. Full TypeScript currently reports four pre-existing implicit-any errors in the attendance route and lecture-review export helper.
