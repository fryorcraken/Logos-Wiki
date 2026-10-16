import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "../..");
const shims = path.join(dir, "shims");
const configPath = path.join(dir, "config.ts");
const polyfill = readFileSync(path.join(dir, "polyfill.js"), "utf8");
const snapshotPath = path.join(dir, "../data/snapshot.jsonl");
const events = existsSync(snapshotPath)
  ? readFileSync(snapshotPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const envelope = JSON.parse(line);
        const event = JSON.parse(envelope.data);
        event.id = createHash("sha256").update(envelope.data, "utf8").digest("hex");
        return event;
      })
  : [];
writeFileSync(path.join(dir, "../qml/snapshot.js"), `.pragma library\nvar EVENTS = ${JSON.stringify(events)};\n`);

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(dir, "entry.ts")],
  bundle: true,
  format: "iife",
  globalName: "WikiEngine",
  target: "es2015",
  define: { Map: "WikiDict", Set: "WikiBag" },
  outfile: path.join(dir, "../qml/wiki.js"),
  legalComments: "none",
  banner: {
    js: `.pragma library\n${polyfill}`,
  },
  footer: {
    js: [
      "ADMIN_KEY",
      "createWiki",
      "ingest",
      "ingestEvents",
      "resetEngine",
      "ingestEnvelope",
      "ingestSnapshotEvents",
      "engineHas",
      "engineStats",
      "engineRenderPage",
      "engineTitles",
      "engineRecent",
      "engineTrusted",
      "engineAccountName",
      "engineCanEdit",
      "engineAccountTaken",
      "engineRevisions",
      "enginePageExists",
      "engineLatestText",
      "engineFollowRedirect",
      "enginePreview",
      "engineDiff",
      "engineIsAdmin",
      "engineAuth",
      "engineSetTheme",
      "normalizeUsername",
      "latestText",
      "richText",
      "renderPage",
      "pageTitles",
      "recent",
      "accountName",
      "canEditPage",
      "publishBody",
      "parseWikiHref",
      "parseWikiLink",
      "splitArticleHtml",
      "followRedirect",
      "appendSection",
      "bytesToHex",
      "canonicalTitle",
      "decodeMessage",
      "deriveSeed",
      "diffRows",
      "formatDate",
      "formatDateTime",
      "formatNumber",
      "formatTime",
      "hexToBytes",
      "joinBase64Chunks",
      "MAIN_PAGE",
      "MAX_TEXT",
      "parseTitle",
      "PRESET",
      "publicKey",
      "render",
      "replaceSection",
      "sectionText",
      "sign",
      "SITENAME",
      "SNAPSHOT_CID",
      "TOPIC",
      "validUsername",
      "verify",
      "Wiki",
    ]
      .map((name) => `var ${name} = WikiEngine.${name};`)
      .join("\n"),
  },
  plugins: [
    {
      name: "wiki-config",
      setup(build) {
        build.onResolve({ filter: /(?:^|[./])config\.ts$/ }, (args) => {
          if (args.importer.includes(`${path.sep}src${path.sep}lib${path.sep}`)) return { path: configPath };
        });
      },
    },
  ],
  alias: {
    "@noble/curves/ed25519.js": path.join(shims, "ed25519.ts"),
  },
});

const outfile = path.join(dir, "../qml/wiki.js");
const shim = readFileSync(path.join(dir, "collections-shim.js"), "utf8");
const wikiJs = readFileSync(outfile, "utf8");
const needle = "var WikiEngine = (() => {\n";
if (!wikiJs.includes(needle)) throw new Error("wiki.js IIFE start not found");
writeFileSync(outfile, wikiJs.replace(needle, `${needle}${shim}\n`));
console.log("wrote basecamp/qml/wiki.js");
