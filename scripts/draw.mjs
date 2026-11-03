// Draws the profile's panels as SVGs in the style of ehsanyaqoob.com: black, Fraunces headings,
// Instrument Sans text, Caveat notes, hand-drawn marks. Text becomes shapes because GitHub's
// image sandbox can't load fonts. Run: node scripts/draw.mjs
import { readFileSync, writeFileSync } from "node:fs";
import opentype from "opentype.js";

const root = new URL("..", import.meta.url);
const file = (p) => new URL(p, root);
const WIDTH = 860;

const C = {
  paper: "#000000", surface: "#0E0E11", ink: "#F5F5F7", body: "#D1D5DB", muted: "#A8A8B2", line: "#28282E",
  blue: "#3B82F6", blueSoft: "#60A5FA", accent: "#2563EB", violet: "#A78BFA", orange: "#FB923C", sky: "#38BDF8", green: "#22C55E",
};

// ---------- text ----------

const load = (p) => {
  const b = readFileSync(file(`src/fonts/${p}.woff`));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const FONTS = {
  light: load("fraunces-latin-300-normal"),
  display: load("fraunces-latin-600-normal"),
  sans: load("instrument-sans-latin-400-normal"),
  medium: load("instrument-sans-latin-500-normal"),
  semi: load("instrument-sans-latin-600-normal"),
  hand: load("caveat-latin-500-normal"),
};

// Each letter is defined once per panel and reused, which keeps the files small.
let letters = new Map();

const widthOf = (s, size, font = "sans", track = 0) => FONTS[font].getAdvanceWidth(s, size) + track * size * (s.length - 1);

function text(s, x, y, { size = 16, font = "sans", fill = C.ink, track = 0, anchor = "start", rot = 0 } = {}) {
  const f = FONTS[font];
  const w = widthOf(s, size, font, track);
  let pen = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  const scale = size / f.unitsPerEm;
  const glyphs = f.stringToGlyphs(s);
  let out = "";
  glyphs.forEach((g, i) => {
    if (g.path?.commands?.length) {
      const id = `${font}${g.index}`;
      if (!letters.has(id)) letters.set(id, `<path id="${id}" d="${g.getPath(0, 0, 1000).toPathData(0)}"/>`);
      out += `<use href="#${id}" transform="translate(${pen.toFixed(1)} ${y.toFixed(1)}) scale(${(size / 1000).toFixed(3)})"/>`;
    }
    pen += g.advanceWidth * scale + track * size;
    if (glyphs[i + 1]) pen += f.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return `<g fill="${fill}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ""}>${out}</g>`;
}

function wrap(s, size, max, font) {
  const lines = [];
  let line = "";
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (widthOf(next, size, font) > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  return [...lines, line];
}

function paragraph(s, x, y, max, { size = 16, font = "sans", fill = C.body, leading = 1.5 } = {}) {
  const lines = wrap(s, size, max, font);
  return { svg: lines.map((l, i) => text(l, x, y + i * size * leading, { size, font, fill })).join(""), bottom: y + (lines.length - 1) * size * leading };
}

// ---------- marks, traced from the site's components/Sketch.tsx ----------

const fit = (d, sx, sy, tx, ty) => {
  let isX = true;
  return d.replace(/-?\d+(\.\d+)?/g, (n) => {
    const v = isX ? +n * sx + tx : +n * sy + ty;
    isX = !isX;
    return v.toFixed(1);
  });
};
const stroke = (d, color, width = 3, extra = "") =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

const MARKS = {
  swash: [300, 30, ["M4 12 C 70 3, 170 2, 292 8 C 250 13, 170 15, 96 20 C 140 19, 200 20, 244 25"]],
  wave: [200, 14, ["M2 7 Q 14 0, 26 7 T 50 7 T 74 7 T 98 7 T 122 7 T 146 7 T 170 7 T 197 7"]],
  double: [200, 14, ["M2 4 C 60 1, 140 1, 198 3", "M34 11 C 80 8, 130 8, 172 10"]],
  oval: [300, 100, ["M170 7 C 246 3, 296 24, 293 51 C 290 81, 210 96, 130 93 C 56 91, 5 75, 7 46 C 9 20, 84 4, 200 11"]],
};
const mark = (name, x, y, w, h, color, width = 3) => {
  const [bw, bh, paths] = MARKS[name];
  return paths.map((d) => stroke(fit(d, w / bw, h / bh, x, y), color, width)).join("");
};
function loops(cx, cy, size, weight = 1) {
  const s = size / 400;
  const at = (d) => fit(d, s, s, cx - size / 2, cy - size / 2);
  return (
    stroke(at("M214 12 C 318 14, 392 96, 388 204 C 384 312, 298 392, 192 388 C 86 384, 8 300, 14 192 C 20 88, 104 8, 232 20"), "#3B82F6", 3.5 * weight) +
    stroke(at("M120 46 C 218 -6, 340 34, 374 138 C 408 246, 346 358, 236 380 C 122 402, 26 332, 12 226 C -2 130, 50 66, 138 36"), "#A78BFA", 2 * weight)
  );
}
const arrow = (x, y, scale, color, rot = 0) => {
  const turn = rot ? ` transform="rotate(${rot} ${x + 60 * scale} ${y + 30 * scale})"` : "";
  return ["M5 14 C 30 50, 72 56, 110 28", "M90 24 L 111 27 L 102 46"].map((d) => stroke(fit(d, scale, scale, x, y), color, 2.2, turn)).join("");
};
const sparks = (x, y, scale, color) => ["M5 26 L 15 22", "M10 8 L 18 16", "M27 4 L 25 15"].map((d) => stroke(fit(d, scale, scale, x, y), color, 3.4)).join("");
function corners(x, y, w, h, color) {
  const a = fit("M3 44 C 2 28, 3 14, 6 6 C 16 3, 30 2, 46 3", 1, 1, x, y);
  const b = fit("M3 44 C 2 28, 3 14, 6 6 C 16 3, 30 2, 46 3", -1, -1, x + w, y + h);
  return stroke(a, color, 2.4) + stroke(b, color, 2.4);
}

// ---------- icons, from the site's lucide-react and react-icons ----------

const ICONS = JSON.parse(readFileSync(file("src/icons.json"), "utf8"));
function icon(name, x, y, size, color) {
  return ICONS[name]
    .replace(/<svg[^>]*?(viewBox="[^"]*")[^>]*?(stroke-width="[^"]*")?[^>]*>/, (root) => {
      const box = root.match(/viewBox="[^"]*"/)[0];
      const lined = root.includes('fill="none"');
      return `<svg x="${x}" y="${y}" width="${size}" height="${size}" ${box} ${lined ? `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"` : `fill="${color}"`}>`;
    })
    .replace(/currentColor/g, color);
}

const SKILL_ICONS = {
  Swift: ["SiSwift", "#F05138"], SwiftUI: ["SiSwift", "#4F8CFF"], UIKit: ["LayoutGrid"], SwiftData: ["Database"], "Core Data": ["HardDrive"],
  "Swift Concurrency": ["Zap"], Combine: ["Share2"], WidgetKit: ["SquareStack"], "Live Activities": ["Activity"], "App Intents": ["Sparkles"],
  "Core Location": ["MapPin"], Notifications: ["Bell"], XCTest: ["FlaskConical"], Instruments: ["Gauge"],
  Dart: ["SiDart", "#29B6F6"], Flutter: ["SiFlutter", "#54C5F8"], "Custom widgets": ["Palette"], Animations: ["Wand2"], Riverpod: ["Workflow"],
  Bloc: ["Boxes"], GetX: ["Zap"], Provider: ["Share2"], Hive: ["Database"], "Platform channels": ["PlugZap"], "ML Kit": ["ScanLine"],
  "Google Maps": ["SiGooglemaps", "#EA4335"], "Unit tests": ["FlaskConical"], "Widget tests": ["FlaskConical"],
  "Clean Architecture": ["Layers"], MVVM: ["Boxes"], "Offline-first sync": ["WifiOff"], "Design systems": ["Palette"],
  Supabase: ["SiSupabase", "#3ECF8E"], Firebase: ["SiFirebase", "#FFCA28"], "Cloud Messaging": ["Send"], "REST APIs": ["Server"],
  Fastlane: ["SiFastlane", "#4CD964"], "GitHub Actions": ["SiGithubactions", "#5AA9FF"], Shorebird: ["RefreshCw"], "App Store Connect": ["SiApple", "#FFFFFF"],
  TestFlight: ["Plane"], "Play Console": ["SiGoogleplay", "#34A853"], Xcode: ["SiXcode", "#4F8CFF"], "Android Studio": ["SiAndroidstudio", "#3DDC84"],
  "VS Code": ["SiVisualstudiocode", "#3BA7F5"], Git: ["SiGit", "#F05032"], Figma: ["SiFigma", "#F24E1E"], Postman: ["SiPostman", "#FF6C37"],
};

function pill(name, x, y) {
  const [ic, color] = SKILL_ICONS[name];
  const w = pillWidth(name);
  return `<rect x="${x}" y="${y}" width="${w}" height="29" rx="14.5" fill="#FFFFFF" fill-opacity=".04" stroke="#FFFFFF" stroke-opacity=".1"/>${icon(ic, x + 10, y + 7.5, 14, color || "#9CA3AF")}${text(name, x + 30, y + 19.5, { size: 13, font: "medium", fill: "#E5E7EB" })}`;
}
const pillWidth = (name) => Math.ceil(widthOf(name, 13, "medium")) + 42;

function pills(items, x, y, max) {
  let cx = x;
  let cy = y;
  let out = "";
  for (const item of items) {
    const w = pillWidth(item);
    if (cx + w > x + max && cx > x) {
      cx = x;
      cy += 36;
    }
    out += pill(item, cx, cy);
    cx += w + 7;
  }
  return { svg: out, bottom: cy + 29 };
}

// ---------- panels ----------

const jpeg = (p) => `data:image/jpeg;base64,${readFileSync(file(p)).toString("base64")}`;

function sheet(width, height, body, radius = 22) {
  const defs = [...letters.values()].join("");
  letters = new Map();
  const shape = typeof radius === "string" ? `<path d="${radius}" fill="${C.paper}"/>` : `<rect width="${width}" height="${height}" rx="${radius}" fill="${C.paper}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">
<defs>${defs}</defs>
${shape}
${body}
</svg>`;
}

// The moving network behind the site, frozen.
function network(seedValue, w, h, count) {
  let seed = seedValue;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const nodes = Array.from({ length: count }, () => [r() * w, r() * h]);
  let out = "";
  nodes.forEach(([x, y], i) => {
    nodes.slice(i + 1).forEach(([a, b]) => {
      if (Math.hypot(x - a, y - b) < 150) out += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} L${a.toFixed(0)} ${b.toFixed(0)}" stroke="#FFFFFF" stroke-opacity=".07"/>`;
    });
  });
  nodes.forEach(([x, y]) => (out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="1.5" fill="#FFFFFF" fill-opacity=".55"/>`));
  return out;
}

function intro() {
  const cx = 668;
  const cy = 186;
  const r = 116;
  const me = jpeg("src/me.jpg");
  const x = 40;
  const about = paragraph("I build native iPhone apps with Swift and SwiftUI, solo from architecture through App Review. Flutter when a product needs it.", x, 272, 430, { size: 18, leading: 1.5 });
  const y = about.bottom + 40;
  return sheet(
    WIDTH,
    Math.max(y + 34, 400),
    `${network(29, WIDTH, 400, 16)}
${text("Hey, I'm", x, 104, { size: 74, font: "light", track: -0.02 })}
${text("Ehsan", x, 188, { size: 92, font: "display", track: -0.02 })}
${mark("swash", x - 2, 196, 272, 26, C.blue, 3)}
${about.svg}
<circle cx="${x + 5}" cy="${y - 5}" r="5" fill="${C.green}"/>${text("iOS Developer · Islamabad, Pakistan", x + 20, y, { size: 17, font: "semi", fill: C.ink })}
<clipPath id="face"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
<image href="${me}" x="${cx - 166}" y="${cy - 116}" width="332" height="277" clip-path="url(#face)"/>
${loops(cx, cy, 282, 0.85)}
${sparks(cx - 158, cy - 148, 1.15, C.violet)}
${text("that's me", cx - 170, cy + 150, { size: 28, font: "hand", fill: C.blueSoft, rot: -6 })}
${arrow(cx - 96, cy + 116, 0.52, C.blueSoft, -28)}`,
  );
}

function contactTitle() {
  return sheet(WIDTH, 84, `${text("Contact", 40, 50, { size: 34, font: "display", track: -0.015 })}${mark("wave", 39, 60, 124, 9, C.sky, 2.6)}`);
}

function contactTile({ ic, color, label, value }) {
  const w = 286;
  const h = 84;
  const m = 5;
  return sheet(
    w,
    h,
    `<rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="18" fill="${C.surface}" stroke="${C.line}"/>
${icon(ic, m + 18, 31, 22, color)}${text(label, m + 54, 37, { size: 13, font: "semi", fill: C.muted })}${text(value, m + 54, 58, { size: 15, font: "medium" })}`,
    "M0 0Z",
  );
}

const PLATFORMS = [
  {
    title: "iOS Development", logo: "SiSwift", logoColor: "#F05138", line: C.orange, mark: "wave",
    rows: [["Language", ["Swift"]], ["UI", ["SwiftUI", "UIKit"]], ["Data", ["SwiftData", "Core Data"]], ["Async", ["Swift Concurrency", "Combine"]], ["System", ["WidgetKit", "Live Activities", "App Intents", "Core Location", "Notifications"]], ["Quality", ["XCTest", "Instruments"]]],
  },
  {
    title: "Flutter Development", logo: "SiFlutter", logoColor: "#54C5F8", line: C.sky, mark: "swash",
    rows: [["Language", ["Dart"]], ["UI", ["Flutter", "Custom widgets", "Animations"]], ["State", ["Riverpod", "Bloc", "GetX", "Provider"]], ["Data", ["Hive"]], ["Native", ["Platform channels", "ML Kit", "Google Maps"]], ["Quality", ["Unit tests", "Widget tests"]]],
  },
];
const SHARED = [
  ["Architecture", "Layers", ["Clean Architecture", "MVVM", "Offline-first sync", "Design systems"]],
  ["Backend", "Cloud", ["Supabase", "Firebase", "Cloud Messaging", "REST APIs"]],
  ["Release & CI/CD", "Rocket", ["Fastlane", "GitHub Actions", "Shorebird", "App Store Connect", "TestFlight", "Play Console"]],
  ["Tools", "Wrench", ["Xcode", "Android Studio", "VS Code", "Git", "Figma", "Postman"]],
];

function skills() {
  const skillsW = widthOf("Languages & Tools", 36, "display", -0.015);
  let out = `${network(83, WIDTH, 300, 12)}${mark("oval", 20, 14, skillsW + 68, 80, C.blue, 2.6)}${text("Languages & Tools", 54, 66, { size: 36, font: "display", track: -0.015 })}`;
  out += text("What I use to build and ship", 40, 122, { size: 16, fill: C.muted });
  const top = 152;
  const colW = 390;
  let bottom = top;
  PLATFORMS.forEach((p, i) => {
    const x = 28 + i * (colW + 24);
    let y = top + 86;
    let rows = "";
    for (const [label, items] of p.rows) {
      rows += text(label, x + 18, y + 19, { size: 13, font: "semi", fill: C.muted });
      const row = pills(items, x + 84, y, colW - 96);
      rows += row.svg;
      y = row.bottom + 10;
    }
    const titleW = widthOf(p.title, 25, "display", -0.01);
    out += icon(p.logo, x + 33, top + 26, 26, p.logoColor) + loops(x + 46, top + 39, 52, 0.45);
    out += text(p.title, x + 84, top + 47, { size: 25, font: "display", track: -0.01 });
    out += mark(p.mark, x + 84, top + 53, titleW, p.mark === "wave" ? 8 : 14, p.line, 2.4);
    out += rows;
    bottom = Math.max(bottom, y);
  });
  PLATFORMS.forEach((p, i) => (out += corners(28 + i * (colW + 24), top, colW, bottom - top + 6, p.line)));

  const sharedY = bottom + 44;
  const sharedW = widthOf("Across both platforms", 25, "display", -0.01);
  out += text("Across both platforms", 40, sharedY, { size: 25, font: "display", track: -0.01 });
  out += mark("double", 40, sharedY + 8, sharedW, 11, C.blue, 2.4);
  const boxW = 396;
  let y = sharedY + 36;
  for (let r = 0; r < 2; r++) {
    let rowBottom = y;
    const boxes = SHARED.slice(r * 2, r * 2 + 2).map(([title, ic, items], i) => {
      const x = 28 + i * (boxW + 12);
      const titleW2 = widthOf(title, 17, "semi");
      const list = pills(items, x + 18, y + 54, boxW - 36);
      rowBottom = Math.max(rowBottom, list.bottom + 18);
      return { x, svg: `${icon(ic, x + 18, y + 18, 19, C.blueSoft)}${stroke(`M${x + 46} ${y + 34} C ${x + 70} ${y + 30}, ${x + 46 + titleW2 - 20} ${y + 32}, ${x + 46 + titleW2} ${y + 33}`, C.blue, 9, ' opacity=".4"')}${text(title, x + 46, y + 33, { size: 17, font: "semi" })}${list.svg}` };
    });
    for (const b of boxes) out += `<rect x="${b.x}" y="${y}" width="${boxW}" height="${rowBottom - y}" rx="18" fill="${C.surface}" stroke="#FFFFFF" stroke-opacity=".06"/>${b.svg}`;
    y = rowBottom + 12;
  }
  return sheet(WIDTH, y + 14, out);
}

const PROJECTS = [
  { id: "tally", title: "Tally", kind: "iOS · Live", brand: "#4F8CFF", shot: ["tally-2", 296], tag: "Log an expense by tapping the back of your iPhone, with the app closed.", note: "my newest app", stack: ["Swift", "App Intents", "ActivityKit"], cta: "App Store", ctaIcon: "SiApple" },
  { id: "niyyah", title: "Niyyah", kind: "iOS · Live", brand: "#22B8A0", shot: ["niyyah-2", 296], tag: "Prayer tracker with GPS-based times, streaks, and a Qibla compass.", note: "survived 3 App Review rejections", stack: ["SwiftUI", "SwiftData", "Supabase"], cta: "App Store", ctaIcon: "SiApple" },
  { id: "mizan", title: "Mizan", kind: "Flutter · Live", brand: "#D0785C", shot: ["mizan-2", 349], tag: "Income, FBR tax, and PDF invoices for freelancers in Pakistan.", note: "no more tax spreadsheets", stack: ["Flutter", "Riverpod", "Hive"], cta: "App Store", ctaIcon: "SiApple" },
  { id: "dsa", title: "Digital Sergeant", kind: "Flutter · In production", brand: "#2F6FDE", shot: ["dsa-2", 372], tag: "E-Challan system for Islamabad Traffic Police, with plate scanning.", note: "paper challans, retired", stack: ["Flutter", "ML Kit OCR"], cta: "Showcase", ctaIcon: "Code2" },
];

function projectsTitle() {
  const w = widthOf("Latest Projects", 36, "display", -0.015);
  return sheet(WIDTH, 118, `${text("Latest Projects", 40, 56, { size: 36, font: "display", track: -0.015 })}${mark("double", 38, 66, w + 4, 13, C.blue, 2.6)}${text("Apps I've designed, built, and shipped", 40, 100 - 2, { size: 16, fill: C.muted })}`);
}

// Half-width tiles: one screen leaning out of the corner, unlike the site's three-frame stage.
function tile(p) {
  const w = 430;
  const h = 300;
  const m = 6;
  const shotH = 330;
  const shotW = (shotH * p.shot[1]) / 640;
  const textW = w - shotW - 36;
  let titleSize = 34;
  while (widthOf(p.title, titleSize, "display", -0.015) > textW - 4) titleSize -= 1;
  const uri = jpeg(`src/frames/${p.shot[0]}.jpg`);
  const tag = paragraph(p.tag, m + 22, 112, textW - 12, { size: 14.5, fill: C.muted, leading: 1.42 });
  let px = m + 22;
  const stack = p.stack.map((s) => {
    const sw = Math.ceil(widthOf(s, 11.5, "medium")) + 18;
    const out = `<rect x="${px}" y="${tag.bottom + 18}" width="${sw}" height="23" rx="11.5" stroke="${C.line}" stroke-width="1.2"/>${text(s, px + 9, tag.bottom + 33.5, { size: 11.5, font: "medium", fill: C.muted })}`;
    px += sw + 5;
    return out;
  }).join("");
  const note = wrap(p.note, 20, textW, "hand");
  const noteY = tag.bottom + 66;
  const ctaW = widthOf(p.cta, 14, "semi") + 66;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none">
<defs>${"LETTERS"}<radialGradient id="glow" cx="78%" cy="55%" r="60%"><stop offset="0" stop-color="${p.brand}" stop-opacity=".38"/><stop offset=".65" stop-color="${p.brand}" stop-opacity=".08"/><stop offset="1" stop-color="${p.brand}" stop-opacity="0"/></radialGradient><clipPath id="card"><rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="22"/></clipPath><clipPath id="shot"><rect x="${w - shotW - 12}" y="26" width="${shotW}" height="${shotH}" rx="14"/></clipPath></defs>
<rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="22" fill="${C.surface}" stroke="${C.line}"/>
<g clip-path="url(#card)"><rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="url(#glow)"/>
<g transform="rotate(5 ${w - shotW / 2} 180)"><image href="${uri}" x="${w - shotW - 12}" y="26" width="${shotW}" height="${shotH}" clip-path="url(#shot)" preserveAspectRatio="xMidYMin slice"/><rect x="${w - shotW - 12}" y="26" width="${shotW}" height="${shotH}" rx="14" stroke="#FFFFFF" stroke-opacity=".12"/></g></g>
<circle cx="${m + 26}" cy="${m + 30}" r="4" fill="${p.brand}"/>${text(p.kind, m + 37, m + 35, { size: 13, font: "semi", fill: C.muted })}
${text(p.title, m + 22, 80, { size: titleSize, font: "display", track: -0.015 })}
${tag.svg}${stack}
${note.map((l, i) => text(l, m + 22, noteY + i * 20, { size: 20, font: "hand", fill: p.brand })).join("")}
<rect x="${m + 22}" y="${h - m - 50}" width="${ctaW}" height="34" rx="17" fill="#16243F"/>${icon(p.ctaIcon, m + 35, h - m - 41, 15, C.blueSoft)}${text(p.cta, m + 57, h - m - 28, { size: 14, font: "semi", fill: "#8CB2FF" })}${icon("ArrowUpRight", m + 57 + widthOf(p.cta, 14, "semi") + 3, h - m - 40, 13, "#8CB2FF")}
</svg>`.replace("LETTERS", () => {
    const defs = [...letters.values()].join("");
    letters = new Map();
    return defs;
  });
}

// ---------- output ----------

const save = (name, svg) => writeFileSync(file(`assets/${name}.svg`), svg);

save("intro", intro());
save("contact", contactTitle());
save("contact-email", contactTile({ ic: "Mail", color: C.blueSoft, label: "Email", value: "ehsanyaqoob07@gmail.com" }));
save("contact-linkedin", contactTile({ ic: "SiLinkedin", color: "#5AA9FF", label: "LinkedIn", value: "in/ehsany" }));
save("contact-x", contactTile({ ic: "SiX", color: "#FFFFFF", label: "X", value: "@iamehsanyaqoob" }));
save("skills", skills());
save("projects", projectsTitle());
PROJECTS.forEach((p) => save(`project-${p.id}`, tile(p)));
