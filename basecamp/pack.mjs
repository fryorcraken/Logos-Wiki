import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const dir = path.dirname(fileURLToPath(import.meta.url));
const meta = JSON.parse(readFileSync(path.join(dir, "metadata.json"), "utf8"));
const version = meta.version;
const variants = ["linux-amd64", "linux-arm64", "darwin-arm64", "windows-x86_64"];
const qmlDir = path.join(dir, "qml");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function walkFiles(root, prefix = "") {
  const out = [];
  for (const name of readdirSync(root).sort()) {
    if (name.startsWith(".")) continue;
    const full = path.join(root, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...walkFiles(full, rel));
    else out.push({ rel, data: readFileSync(full) });
  }
  return out;
}

function leafHash(files) {
  const parts = files
    .slice()
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
    .map((f) => Buffer.concat([Buffer.from(f.rel, "utf8"), Buffer.from([0]), Buffer.from(sha256(f.data), "utf8"), Buffer.from([10])]));
  return sha256(Buffer.concat(parts));
}

function parentHash(childMap) {
  const names = Object.keys(childMap).sort();
  const parts = names.map((name) =>
    Buffer.concat([Buffer.from(name, "utf8"), Buffer.from([0]), Buffer.from(childMap[name], "utf8"), Buffer.from([10])]),
  );
  return sha256(Buffer.concat(parts));
}

function ustar(name, data, mode = 0o644) {
  const buf = Buffer.alloc(512);
  const size = data.length;
  const write = (off, str, len) => buf.write(str, off, Math.min(str.length, len), "utf8");
  const oct = (off, n, len) => write(off, n.toString(8).padStart(len - 1, "0"), len);
  write(0, name, 100);
  oct(100, mode, 8);
  oct(108, 0, 8);
  oct(116, 0, 8);
  oct(124, size, 12);
  oct(136, 0, 12);
  write(156, "0", 1);
  write(257, "ustar", 6);
  buf[263] = 0x30;
  buf[264] = 0x30;
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : buf[i];
  write(148, (sum.toString(8).padStart(6, "0") + "\0 "), 8);
  const pad = (512 - (size % 512)) % 512;
  return Buffer.concat([buf, data, Buffer.alloc(pad)]);
}

function dirEntry(name) {
  const buf = Buffer.alloc(512);
  const write = (off, str, len) => buf.write(str, off, Math.min(str.length, len), "utf8");
  const oct = (off, n, len) => write(off, n.toString(8).padStart(len - 1, "0"), len);
  write(0, name.endsWith("/") ? name : name + "/", 100);
  oct(100, 0o755, 8);
  oct(108, 0, 8);
  oct(116, 0, 8);
  oct(124, 0, 12);
  oct(136, 0, 12);
  write(156, "5", 1);
  write(257, "ustar", 6);
  buf[263] = 0x30;
  buf[264] = 0x30;
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : buf[i];
  write(148, (sum.toString(8).padStart(6, "0") + "\0 "), 8);
  return buf;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

const icon = readFileSync(path.join(dir, "assets/icon.png"));
const qmlFiles = walkFiles(qmlDir).filter((f) => f.rel !== "wiki.js.map");
const metadata = Buffer.from(JSON.stringify(meta, null, 2) + "\n");
const variantFiles = [
  { rel: "metadata.json", data: metadata },
  ...qmlFiles.map((f) => ({ rel: `qml/${f.rel}`, data: f.data })),
];

const variantHash = leafHash(variantFiles);
const assetHash = leafHash([{ rel: "icon.png", data: icon }]);
const variantsHash = parentHash(Object.fromEntries(variants.map((name) => [name, variantHash])));
const hashes = {
  assets: assetHash,
  root: parentHash({ assets: assetHash, variants: variantsHash }),
  variants: variantsHash,
};
for (const name of variants) hashes[`variants/${name}`] = variantHash;

const manifest = sortKeys({
  author: meta.author,
  category: meta.category,
  dependencies: meta.dependencies,
  description: meta.description,
  display_name: meta.display_name,
  hashes,
  icon: "assets/icon.png",
  main: Object.fromEntries(variants.map((name) => [name, "qml/Main.qml"])),
  manifestVersion: "0.6.0",
  name: meta.name,
  provides: meta.provides,
  type: meta.type,
  version,
  view: meta.view,
});
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");

const entries = [];
const addDir = (name) => entries.push({ path: name, dir: true });
const addFile = (name, data) => entries.push({ path: name, data });
addFile("manifest.json", manifestBytes);
addDir("assets");
addFile("assets/icon.png", icon);
addDir("variants");
for (const name of variants) {
  addDir(`variants/${name}`);
  addDir(`variants/${name}/qml`);
  for (const file of variantFiles) addFile(`variants/${name}/${file.rel}`, file.data);
}

entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
const tarParts = [];
for (const entry of entries) {
  if (entry.dir) tarParts.push(dirEntry(entry.path));
  else tarParts.push(ustar(entry.path, entry.data));
}
tarParts.push(Buffer.alloc(1024));
const tar = Buffer.concat(tarParts);
const gz = gzipSync(tar, { level: 9 });
gz[4] = 0;
gz[5] = 0;
gz[6] = 0;
gz[7] = 0;
gz[8] = 0;
gz[9] = 0xff;

const dist = path.join(dir, "dist");
mkdirSync(dist, { recursive: true });
const lgxName = `${meta.name}-${version}.lgx`;
const lgxPath = path.join(dist, lgxName);
writeFileSync(lgxPath, gz);

const urlMain = `https://raw.githubusercontent.com/uNexpectedR/Logos-Wiki/main/basecamp/dist/${lgxName}`;
const urlRelease = `https://github.com/uNexpectedR/Logos-Wiki/releases/download/basecamp-v${version}/${lgxName}`;
const index = {
  schemaVersion: 2,
  repositoryName: "logos-wiki",
  generatedAt: new Date().toISOString(),
  latest: version,
  packages: [
    {
      name: meta.name,
      versions: [
        {
          releasedAt: new Date().toISOString(),
          publisherRef: `basecamp-v${version}`,
          url: urlMain,
          urls: [urlMain, urlRelease],
          size: gz.length,
          sha256: sha256(gz),
          rootHash: hashes.root,
          manifest,
        },
      ],
    },
  ],
};
writeFileSync(path.join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");

const repo = {
  schemaVersion: 1,
  name: "logos-wiki",
  displayName: "Logos Wiki",
  description: "Native Basecamp app for the Logos Wiki.",
  homepage: "https://github.com/uNexpectedR/Logos-Wiki",
  indexUrl: "https://raw.githubusercontent.com/uNexpectedR/Logos-Wiki/main/basecamp/index.json",
  trustedSigners: [],
};
writeFileSync(path.join(dir, "logos-repo.json"), JSON.stringify(repo, null, 2) + "\n");

console.log("packed", lgxPath, gz.length, "bytes");
console.log("rootHash", hashes.root);
