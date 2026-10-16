# Logos Wiki for Basecamp

A `ui_qml` app that reads and writes the same signed event log as the [web wiki](https://github.com/uNexpectedR/Logos-Wiki), through Logos Storage and Delivery.

The Vector 2022 HTML skin cannot run in Basecamp. This client keeps the wikitext, history, accounts and trust rules, and approximates the layout in QML.

## Install in Basecamp 0.3.2

1. Open **Package Manager**.
2. Add repository and paste:

   `https://raw.githubusercontent.com/uNexpectedR/Logos-Wiki/main/basecamp/logos-repo.json`

3. Install **Logos Wiki**. Basecamp will also need **Delivery Module** from Logos Official (the wiki lists it as a dependency). Storage is already bundled with Basecamp.
4. Open **Logos Wiki** from the sidebar. The imported wiki (Main Page and the rest of the LAN pages) loads on first open from a bundled snapshot. No Settings paste is required.
5. Optional: **Settings** can override the shipped admin public key or a Storage snapshot CID if you are following a different log.

If catalog download hangs on Storage, install the `.lgx` from disk: **Install Local Package** and choose `basecamp/dist/logos-wiki-0.1.7.lgx`. Optional deep link after install: `basecamp://intent/wiki.open`.

## Build

```sh
cd basecamp
npm install
npm test
npm run pack
```

`npm run pack` writes `qml/wiki.js`, `qml/snapshot.js`, `dist/logos-wiki-0.1.7.lgx`, `index.json` and `logos-repo.json`. First open loads the bundled snapshot from `data/snapshot.jsonl`. Regenerate with `npm run snapshot-basecamp` from the repo root (needs the source wiki).

## What it talks to

- `delivery_module` on topic `/logos-wiki/1/lan/json` (preset `logos.dev`)
- `storage_module.downloadChunks` for snapshot CIDs announced on that topic

Edits are ed25519-signed JSON events, same as the web wiki. Accounts use the same name/password scrypt keys as the web app — Basecamp 0.3.2 has no identity module (official keystore/wallet packages are Ethereum/Monero, not wiki Ed25519).
