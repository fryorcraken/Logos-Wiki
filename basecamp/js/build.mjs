import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "../..");
const shims = path.join(dir, "shims");
const configPath = path.join(dir, "config.ts");
const polyfill = readFileSync(path.join(dir, "polyfill.js"), "utf8");

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(dir, "entry.ts")],
  bundle: true,
  format: "iife",
  globalName: "WikiEngine",
  target: "es2015",
  outfile: path.join(dir, "../qml/wiki.js"),
  legalComments: "none",
  banner: {
    js: `.pragma library\n${polyfill}`,
  },
  footer: {
    js: [
      "createWiki",
      "ingest",
      "latestText",
      "richText",
      "renderPage",
      "pageTitles",
      "recent",
      "accountName",
      "canEditPage",
      "publishBody",
      "parseWikiLink",
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

console.log("wrote basecamp/qml/wiki.js");
