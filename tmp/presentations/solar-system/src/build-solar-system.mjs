import fs from "node:fs/promises";
import path from "node:path";

const artifactToolUrl =
  "file:///C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const {
  Presentation,
  PresentationFile,
  text,
  fill,
  hug,
  wrap,
  column,
  row,
  grid,
  fr,
  fixed,
  panel,
  rule,
} = await import(artifactToolUrl);

const ROOT = "D:/mindXLeader/version TMS/V1/tmsmindx/tmp/presentations/solar-system";
const ASSETS = `${ROOT}/scratch/assets`;
const OUTPUT = `${ROOT}/output`;
const PREVIEWS = `${ROOT}/scratch/previews`;
const LAYOUTS = `${ROOT}/scratch/layouts`;
const PPTX = `${OUTPUT}/output.pptx`;

const W = 1920;
const H = 1080;

const imageBlobs = new Map();
for (const name of [
  "solar-system-montage",
  "sun-filament",
  "earth-blue-marble",
  "jupiter-juno",
  "saturn-cassini",
  "ceres",
]) {
  imageBlobs.set(name, await fs.readFile(`${ASSETS}/${name}.jpg`));
}

const C = {
  space: "#070915",
  space2: "#0D1022",
  ink: "#F7F2E8",
  muted: "#B8C1D9",
  faint: "#65708C",
  sun: "#F6B24A",
  sun2: "#F26938",
  blue: "#56B9FF",
  cyan: "#78E2D7",
  rust: "#D66B45",
  violet: "#9B8CFF",
  green: "#7CD48D",
  line: "#2D3655",
  white: "#FFFFFF",
};

const font = "Segoe UI";
const titleFont = "Bahnschrift";

function addShape(slide, geometry, x, y, width, height, opts = {}) {
  return slide.shapes.add({
    geometry,
    position: { left: x, top: y, width, height },
    fill: opts.fill,
    line: opts.line,
    borderRadius: opts.borderRadius,
    shadow: opts.shadow,
  });
}

function addText(slide, value, x, y, width, height, style = {}, name = "text") {
  slide.compose(
    text(value, {
      name,
      width: fill,
      height: hug,
      style: {
        fontFamily: font,
        color: C.ink,
        fontSize: 28,
        ...style,
      },
    }),
    { frame: { left: x, top: y, width, height }, baseUnit: 8 },
  );
}

function addTitle(slide, title, subtitle) {
  slide.compose(
    column({ name: "title-stack", width: fill, height: hug, gap: 18 }, [
      text(title, {
        name: "slide-title",
        width: fill,
        height: hug,
        style: {
          fontFamily: titleFont,
          fontSize: 62,
          bold: true,
          color: C.ink,
        },
      }),
      subtitle
        ? text(subtitle, {
            name: "slide-subtitle",
            width: wrap(1120),
            height: hug,
            style: {
              fontFamily: font,
              fontSize: 26,
              color: C.muted,
            },
          })
        : rule({ name: "title-rule", width: fixed(220), stroke: C.sun, weight: 4 }),
    ]),
    { frame: { left: 92, top: 70, width: 1240, height: 160 }, baseUnit: 8 },
  );
}

function addFooter(slide, value = "Solar system overview") {
  addText(
    slide,
    value,
    92,
    1028,
    980,
    28,
    { fontSize: 14, color: C.faint },
    "source",
  );
}

function addImage(slide, name, x, y, width, height, opts = {}) {
  return slide.images.add({
    blob: imageBlobs.get(name),
    contentType: "image/jpeg",
    position: { left: x, top: y, width, height },
    fit: opts.fit ?? "cover",
    alt: opts.alt ?? name,
    borderRadius: opts.borderRadius,
    geometry: opts.geometry,
    crop: opts.crop,
  });
}

function addBackground(slide, fillColor = C.space) {
  const bg = addShape(slide, "rect", 0, 0, W, H, { fill: fillColor });
  bg.sendToBack();
  return bg;
}

function addStars(slide, count, seed = 4) {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    const size = next() > 0.86 ? 3.5 : 2;
    const opacity = next() > 0.74 ? "D0" : "74";
    addShape(slide, "ellipse", next() * W, next() * H, size, size, {
      fill: `${C.white}${opacity}`,
      line: { color: `${C.white}00`, width: 0 },
    });
  }
}

function planetDot(slide, x, y, r, color, label, sublabel, labelSide = "below") {
  addShape(slide, "ellipse", x - r, y - r, r * 2, r * 2, {
    fill: color,
    line: { color: "#FFFFFF44", width: 1 },
  });
  const lx = labelSide === "left" ? x - 210 : x - 70;
  const ly = labelSide === "above" ? y - r - 68 : y + r + 14;
  addText(slide, label, lx, ly, 180, 28, { fontSize: 20, bold: true, color: C.ink }, `label-${label}`);
  if (sublabel) {
    addText(slide, sublabel, lx, ly + 28, 210, 30, { fontSize: 15, color: C.muted }, `sublabel-${label}`);
  }
}

function callout(slide, title, body, x, y, accent = C.sun, width = 460) {
  addShape(slide, "rect", x, y + 8, 5, 82, { fill: accent });
  addText(slide, title, x + 24, y, width, 32, { fontSize: 26, bold: true, color: C.ink }, `callout-title-${title}`);
  addText(slide, body, x + 24, y + 40, width, 84, { fontSize: 21, color: C.muted }, `callout-body-${title}`);
}

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

// 1. Cover
{
  const slide = presentation.slides.add();
  addBackground(slide, "#03040B");
  addImage(slide, "solar-system-montage", 0, 0, W, H, {
    alt: "NASA artist concept montage of the solar system",
  });
  addShape(slide, "rect", 0, 0, W, H, { fill: "#03040BCC" });
  addShape(slide, "rect", 0, 0, 760, H, { fill: "#03040BE8" });
  addShape(slide, "rect", 92, 156, 7, 670, { fill: C.sun });
  addText(
    slide,
    "THE\nSOLAR\nSYSTEM",
    124,
    142,
    660,
    430,
    {
      fontFamily: titleFont,
      fontSize: 112,
      bold: true,
      color: C.ink,
      breakLine: false,
    },
    "cover-title",
  );
  addText(
    slide,
    "A guided tour from the star that holds it together to the icy worlds at its edge.",
    128,
    610,
    620,
    108,
    { fontSize: 31, color: C.muted },
    "cover-subtitle",
  );
  addText(slide, "8 planets. 1 star. Billions of small worlds.", 128, 810, 620, 36, {
    fontSize: 22,
    color: C.sun,
    bold: true,
  }, "cover-kicker");
}

// 2. The Sun
{
  const slide = presentation.slides.add();
  addBackground(slide);
  addStars(slide, 70, 11);
  addImage(slide, "sun-filament", -230, 42, 840, 840, {
    geometry: "ellipse",
    alt: "NASA Solar Dynamics Observatory image of the Sun",
  });
  addShape(slide, "ellipse", -250, 22, 880, 880, {
    fill: "#00000000",
    line: { color: "#FFD27A66", width: 4 },
  });
  addTitle(slide, "The Sun is the system", "Its gravity, light, and solar wind set the rules for everything else.");
  callout(slide, "Mass anchor", "The Sun holds about 99.8% of the solar system's mass.", 790, 326, C.sun, 440);
  callout(slide, "Energy source", "Sunlight drives climates, seasons, and photosynthesis on Earth.", 1180, 500, C.blue, 500);
  callout(slide, "Space weather", "Solar wind shapes magnetic fields, auroras, and radiation environments.", 860, 690, C.rust, 560);
  for (const r of [260, 340, 420, 500]) {
    addShape(slide, "ellipse", 1030 - r / 2, 360 - r / 2, r, r, {
      fill: "#00000000",
      line: { color: "#3C466955", width: 1.2 },
    });
  }
  planetDot(slide, 1030, 100, 10, C.blue, "Earth", "one orbit per year", "below");
  addFooter(slide, "Rounded solar-system facts.");
}

// 3. Inner planets
{
  const slide = presentation.slides.add();
  addBackground(slide, "#0A0B16");
  addTitle(
    slide,
    "The inner worlds are rocky and close",
    "Mercury, Venus, Earth, and Mars formed in the warmer inner disk, where rock and metal could survive.",
  );
  const planets = [
    ["Mercury", "0.39 AU", "Smallest planet; extreme temperature swings", "#AFA79A", 40],
    ["Venus", "0.72 AU", "Thick CO2 atmosphere; hottest surface", "#DDB066", 60],
    ["Earth", "1.00 AU", "Liquid water and a protective magnetosphere", C.blue, 64],
    ["Mars", "1.52 AU", "Cold desert world with ancient river clues", C.rust, 48],
  ];
  const x0 = 186;
  for (let i = 0; i < planets.length; i += 1) {
    const [name, au, desc, color, r] = planets[i];
    const x = x0 + i * 420;
    addShape(slide, "rect", x, 300, 1.5, 550, { fill: "#FFFFFF22" });
    addShape(slide, "ellipse", x + 80 - r / 2, 400 - r / 2, r, r, {
      fill: color,
      line: { color: "#FFFFFF55", width: 1 },
    });
    addText(slide, name, x, 520, 260, 42, { fontSize: 34, bold: true, color: C.ink }, `inner-${name}`);
    addText(slide, au, x, 570, 180, 30, { fontSize: 22, color: C.sun, bold: true }, `inner-au-${name}`);
    addText(slide, desc, x, 640, 300, 92, { fontSize: 23, color: C.muted }, `inner-desc-${name}`);
  }
  addText(slide, "AU = average Earth-Sun distance", 1460, 914, 360, 32, { fontSize: 18, color: C.faint }, "au-note");
  addFooter(slide);
}

// 4. Asteroid belt
{
  const slide = presentation.slides.add();
  addBackground(slide);
  addStars(slide, 56, 21);
  addTitle(slide, "The asteroid belt is not a wall", "Between Mars and Jupiter is a wide region of leftover building blocks, with plenty of empty space.");
  addShape(slide, "ellipse", 174, 504, 80, 80, { fill: C.sun, line: { color: "#FFD27A", width: 2 } });
  addText(slide, "Sun", 160, 604, 120, 30, { fontSize: 20, bold: true, color: C.sun }, "belt-sun-label");
  addShape(slide, "rect", 280, 546, 1300, 2, { fill: "#FFFFFF30" });
  planetDot(slide, 650, 547, 20, C.rust, "Mars", "1.5 AU", "above");
  planetDot(slide, 1460, 547, 54, "#D9A86C", "Jupiter", "5.2 AU", "above");
  let seed = 9;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 78; i += 1) {
    const x = 820 + next() * 410;
    const y = 450 + next() * 200;
    const size = 3 + next() * 7;
    addShape(slide, "ellipse", x, y, size, size, {
      fill: "#C7C9D5AA",
      line: { color: "#FFFFFF00", width: 0 },
    });
  }
  addImage(slide, "ceres", 1028, 390, 110, 110, { geometry: "ellipse", alt: "NASA image of Ceres" });
  callout(slide, "Ceres is the largest object", "It is massive enough to be rounded by gravity, so it is classified as a dwarf planet.", 118, 792, C.cyan, 730);
  callout(slide, "Jupiter acts like a sculptor", "Its gravity stirred the region and helped prevent a full planet from forming there.", 1010, 792, C.sun, 690);
  addFooter(slide);
}

// 5. Giant planets
{
  const slide = presentation.slides.add();
  addBackground(slide, "#090A13");
  addTitle(
    slide,
    "The giant planets are mini systems",
    "Jupiter, Saturn, Uranus, and Neptune are planet-scale environments with moons, rings, storms, and magnetic fields.",
  );
  addImage(slide, "jupiter-juno", 124, 300, 470, 470, {
    geometry: "ellipse",
    alt: "NASA Juno image of Jupiter",
  });
  addImage(slide, "saturn-cassini", 694, 322, 520, 330, {
    alt: "NASA Cassini image of Saturn",
    borderRadius: 24,
  });
  planetDot(slide, 1378, 466, 72, "#78D7D3", "Uranus", "ice giant", "below");
  planetDot(slide, 1636, 480, 68, "#4D7CFF", "Neptune", "fast winds", "below");
  addText(slide, "Jupiter", 246, 792, 250, 42, { fontSize: 36, bold: true }, "jupiter-label");
  addText(slide, "largest planet; strong bands and storms", 194, 846, 390, 34, { fontSize: 21, color: C.muted }, "jupiter-caption");
  addText(slide, "Saturn", 884, 692, 240, 42, { fontSize: 36, bold: true }, "saturn-label");
  addText(slide, "rings make the system visible from across space", 760, 746, 520, 34, { fontSize: 21, color: C.muted }, "saturn-caption");
  callout(slide, "Two families", "Jupiter and Saturn are gas giants; Uranus and Neptune are ice giants with more water, methane, and ammonia.", 124, 930, C.blue, 1120);
  addFooter(slide);
}

// 6. Distance scale
{
  const slide = presentation.slides.add();
  addBackground(slide);
  addTitle(
    slide,
    "Scale breaks intuition",
    "Planet order is easy. Planet spacing is the surprise: the outer planets live far beyond the crowded inner system.",
  );
  const left = 166;
  const right = 1690;
  const y = 596;
  addShape(slide, "rect", left, y, right - left, 4, { fill: "#FFFFFF32" });
  addText(slide, "log scale of average distance from the Sun", left, y - 78, 700, 32, { fontSize: 22, color: C.muted }, "scale-note");
  const planets = [
    ["Mercury", 0.39, "#AFA79A"],
    ["Venus", 0.72, "#DDB066"],
    ["Earth", 1.0, C.blue],
    ["Mars", 1.52, C.rust],
    ["Jupiter", 5.2, "#D9A86C"],
    ["Saturn", 9.58, "#E5C279"],
    ["Uranus", 19.2, "#78D7D3"],
    ["Neptune", 30.1, "#4D7CFF"],
  ];
  const min = Math.log10(0.35);
  const max = Math.log10(32);
  const mapX = (au) => left + ((Math.log10(au) - min) / (max - min)) * (right - left);
  for (const [name, au, color] of planets) {
    const x = mapX(au);
    addShape(slide, "rect", x, y - 42, 2, 84, { fill: "#FFFFFF30" });
    const r = name === "Jupiter" || name === "Saturn" ? 30 : 22;
    addShape(slide, "ellipse", x - r, y - r, r * 2, r * 2, {
      fill: color,
      line: { color: "#FFFFFF55", width: 1 },
    });
    const labelTop = au < 2 ? y + 54 : y - 128;
    addText(slide, name, x - 70, labelTop, 150, 28, { fontSize: 19, bold: true, color: C.ink }, `scale-${name}`);
    addText(slide, `${au} AU`, x - 70, labelTop + 28, 150, 26, { fontSize: 15, color: C.muted }, `scale-au-${name}`);
  }
  addText(
    slide,
    "If Earth is 1 AU from the Sun, Neptune averages about 30 AU away.",
    230,
    830,
    1050,
    46,
    { fontSize: 33, bold: true, color: C.sun },
    "scale-claim",
  );
  addText(slide, "Average orbital distances rounded.", 1374, 928, 380, 28, { fontSize: 16, color: C.faint }, "scale-source");
  addFooter(slide);
}

// 7. Small worlds
{
  const slide = presentation.slides.add();
  addBackground(slide, "#080A18");
  addStars(slide, 86, 33);
  addTitle(
    slide,
    "Small worlds carry old evidence",
    "Dwarf planets, comets, asteroids, and Kuiper Belt objects preserve material from the solar system's formation.",
  );
  addShape(slide, "ellipse", 1120, 254, 980, 980, {
    fill: "#00000000",
    line: { color: "#415078", width: 2 },
  });
  addShape(slide, "ellipse", 1240, 344, 720, 720, {
    fill: "#00000000",
    line: { color: "#2B3555", width: 2 },
  });
  addShape(slide, "ellipse", 1330, 420, 520, 520, {
    fill: "#00000000",
    line: { color: "#232C49", width: 2 },
  });
  const smalls = [
    ["Pluto", 1512, 410, C.violet],
    ["Eris", 1724, 660, "#C9D2EF"],
    ["Comet", 1300, 760, C.cyan],
    ["Arrokoth", 1510, 854, C.rust],
  ];
  for (const [name, x, y, color] of smalls) {
    addShape(slide, "ellipse", x - 20, y - 20, 40, 40, {
      fill: color,
      line: { color: "#FFFFFF55", width: 1 },
    });
    addText(slide, name, x + 28, y - 16, 170, 28, { fontSize: 20, bold: true }, `small-${name}`);
  }
  callout(slide, "Time capsules", "They are less altered by heat and geology than large planets, so they keep chemical clues.", 120, 360, C.cyan, 610);
  callout(slide, "Dynamic leftovers", "Orbits can be nudged by giant planets, sending comets inward or scattering objects outward.", 120, 568, C.sun, 650);
  callout(slide, "Exploration targets", "Missions to asteroids and Kuiper Belt objects test ideas about planet formation.", 120, 776, C.violet, 650);
  addFooter(slide);
}

// 8. Closing synthesis
{
  const slide = presentation.slides.add();
  addBackground(slide, "#050711");
  addImage(slide, "earth-blue-marble", 1140, 0, 780, 1080, {
    alt: "NASA Blue Marble image of Earth",
  });
  addShape(slide, "rect", 1050, 0, 870, H, { fill: "#05071188" });
  addShape(slide, "rect", 0, 0, 1280, H, { fill: "#050711F0" });
  addText(
    slide,
    "The solar system is our nearest laboratory",
    112,
    112,
    880,
    170,
    { fontFamily: titleFont, fontSize: 72, bold: true, color: C.ink },
    "closing-title",
  );
  addText(
    slide,
    "It gives us a close-up record of how planets form, how climates change, and where life might persist.",
    116,
    316,
    880,
    88,
    { fontSize: 30, color: C.muted },
    "closing-subtitle",
  );
  const points = [
    ["Origins", "Planetary leftovers reveal the ingredients that built worlds."],
    ["Habitability", "Comparing Earth, Venus, Mars, and icy moons sharpens the question of life."],
    ["Exploration", "Every mission turns distant dots into places with histories."],
  ];
  for (let i = 0; i < points.length; i += 1) {
    const y = 522 + i * 132;
    addShape(slide, "ellipse", 124, y + 8, 26, 26, { fill: [C.sun, C.blue, C.cyan][i] });
    addText(slide, points[i][0], 176, y, 260, 36, { fontSize: 29, bold: true, color: C.ink }, `closing-${points[i][0]}`);
    addText(slide, points[i][1], 176, y + 42, 680, 48, { fontSize: 23, color: C.muted }, `closing-desc-${points[i][0]}`);
  }
  addText(slide, "From one star, a family of worlds.", 112, 948, 760, 42, {
    fontSize: 30,
    color: C.sun,
    bold: true,
  }, "closing-line");
}

await fs.mkdir(OUTPUT, { recursive: true });
await fs.mkdir(PREVIEWS, { recursive: true });
await fs.mkdir(LAYOUTS, { recursive: true });

async function saveBlob(blob, filePath) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(filePath, bytes);
}

const pptxBlob = await PresentationFile.exportPptx(presentation);
await pptxBlob.save(PPTX);

for (const [idx, slide] of presentation.slides.items.entries()) {
  const png = await slide.export({ format: "png" });
  await saveBlob(png, path.join(PREVIEWS, `slide-${String(idx + 1).padStart(2, "0")}.png`));
  const layout = await slide.export({ format: "layout" });
  await saveBlob(layout, path.join(LAYOUTS, `slide-${String(idx + 1).padStart(2, "0")}.layout.json`));
}

const savedBytes = await fs.readFile(PPTX);
const savedPresentation = await PresentationFile.importPptx(savedBytes);
const savedPreviewDir = path.join(PREVIEWS, "saved-pptx");
await fs.mkdir(savedPreviewDir, { recursive: true });
for (const [idx, slide] of savedPresentation.slides.items.entries()) {
  const png = await slide.export({ format: "png" });
  await saveBlob(png, path.join(savedPreviewDir, `slide-${String(idx + 1).padStart(2, "0")}.png`));
}

console.log(
  JSON.stringify(
    {
      pptx: PPTX,
      slides: presentation.slides.items.length,
      previews: PREVIEWS,
      layouts: LAYOUTS,
      savedPptxPreviews: savedPreviewDir,
    },
    null,
    2,
  ),
);
