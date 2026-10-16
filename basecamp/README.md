# Logos Wiki for Basecamp

A `ui_qml` app that reads and writes the same signed event log as the [web wiki](https://github.com/uNexpectedR/Logos-Wiki), through Logos Storage and Delivery.

The Vector 2022 HTML skin cannot run in Basecamp. This client keeps the wikitext, history, accounts and trust rules, and approximates the layout in QML.

## Install in Basecamp 0.3.2

1. Open **Package Manager**.
2. Add repository and paste:

   `https://raw.githubusercontent.com/uNexpectedR/Logos-Wiki/main/basecamp/logos-repo.json`

3. Install **Logos Wiki**. Basecamp will also need **Delivery Module** from Logos Official (the wiki lists it as a dependency). Storage is already bundled with Basecamp.
4. Open **Logos Wiki** from the sidebar.
5. In **Settings**, paste the web instance’s `WIKI_ADMIN_KEY` (and optional snapshot CID), then save.

If catalog download hangs on Storage, install the `.lgx` from disk: **Install Local Package** and choose `basecamp/dist/logos-wiki-0.1.0.lgx`. Optional deep link after install: `basecamp://intent/wiki.open`.

## Build

```sh
cd basecamp
npm install
npm test
npm run pack
```

`npm run pack` writes `qml/wiki.js`, `dist/logos-wiki-0.1.0.lgx`, `index.json` and `logos-repo.json`.

## What it talks to

- `delivery_module` on topic `/logos-wiki/1/lan/json` (preset `logos.dev`)
- `storage_module.downloadChunks` for snapshot CIDs announced on that topic

Edits are ed25519-signed JSON events, same as the web wiki.
