"use client";

import { useState, type FormEvent } from "react";
import { authHeaders, publish } from "@/client/session.ts";
import { sha256Hex } from "@/lib/events.ts";
import { ErrorBox } from "./account.tsx";

const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_UPLOAD = 50 * 1024 * 1024;

function useTask() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = (task: (data: FormData) => Promise<string | null>) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const message = await task(new FormData(event.currentTarget));
    if (message) setError(message);
    setBusy(false);
  };
  return { error, busy, run };
}

function SubmitButton({ label, busy }: { label: string; busy: boolean }) {
  return (
    <span className="mw-htmlform-submit oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-buttonElement oo-ui-buttonElement-framed oo-ui-labelElement oo-ui-flaggedElement-primary oo-ui-flaggedElement-progressive oo-ui-buttonInputWidget">
      <button type="submit" className="oo-ui-inputWidget-input oo-ui-buttonElement-button" disabled={busy}>
        <span className="oo-ui-labelElement-label">{busy ? "Please wait…" : label}</span>
      </button>
    </span>
  );
}

export function TrustedEditorsForm({ editors }: { editors: string[] }) {
  const { error, busy, run } = useTask();
  const onSubmit = run(async (data) => {
    const names = String(data.get("editors")).split("\n").map((n) => n.trim()).filter(Boolean);
    const result = await publish({ t: "trust", editors: [...new Set(names)] });
    if (!result.ok) return result.error;
    location.reload();
    return null;
  });
  return (
    <form className="mw-htmlform mw-htmlform-ooui" onSubmit={onSubmit}>
      <fieldset className="oo-ui-layout oo-ui-fieldsetLayout">
        <legend className="oo-ui-fieldsetLayout-header">
          <span className="oo-ui-labelElement-label">Edit the list of trusted editors</span>
        </legend>
        {error && <ErrorBox>{error}</ErrorBox>}
        <p>One username per line. Trusted editors can edit every page outside the MediaWiki namespace and upload files.</p>
        <textarea name="editors" rows={10} cols={40} className="mw-editfont-monospace" defaultValue={editors.join("\n")} />
        <div className="mw-htmlform-submit-buttons">
          <SubmitButton label="Save trusted editors" busy={busy} />
        </div>
      </fieldset>
    </form>
  );
}

async function dimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

async function storeFile(file: File, sha: string) {
  const headers = authHeaders(`upload:${sha}`);
  if (!headers) return { error: "Your session has expired. Please log in again." };
  const response = await fetch("/api/upload", { method: "POST", headers: { ...headers, "content-type": file.type }, body: file }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  return response?.ok ? { cid: String(data.cid) } : { error: data?.error ?? "The upload failed." };
}

export function UploadForm() {
  const { error, busy, run } = useTask();
  const [dest, setDest] = useState("");
  const onSubmit = run(async (data) => {
    const file = data.get("wpUploadFile");
    const name = String(data.get("wpDestFile")).trim().replace(/_/g, " ");
    if (!(file instanceof File) || !file.size) return "Please select a file.";
    if (!TYPES.includes(file.type)) return "Only PNG, JPEG, GIF and WebP images can be uploaded.";
    if (file.size > MAX_UPLOAD) return "The file is larger than 50 MB.";
    if (!name) return "Please enter a destination filename.";
    const sha = sha256Hex(new Uint8Array(await file.arrayBuffer()));
    const [size, stored] = await Promise.all([dimensions(file).catch(() => null), storeFile(file, sha)]);
    if (!size) return "The file is not a valid image.";
    if ("error" in stored) return stored.error ?? "The upload failed.";
    const fileName = name.charAt(0).toUpperCase() + name.slice(1);
    const result = await publish({ t: "file", name: fileName, cid: stored.cid, mime: file.type, size: file.size, sha, ...size });
    if (!result.ok) return result.error;
    const description = String(data.get("wpUploadDescription")).trim();
    if (description) await publish({ t: "edit", title: `File:${fileName}`, text: description, summary: "" });
    location.assign(`/wiki/File:${encodeURIComponent(fileName.replace(/ /g, "_"))}`);
    return null;
  });
  return (
    <form id="mw-upload-form" className="mw-htmlform mw-htmlform-ooui" onSubmit={onSubmit}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <fieldset id="mw-htmlform-source" className="oo-ui-layout oo-ui-fieldsetLayout">
        <legend className="oo-ui-fieldsetLayout-header">
          <span className="oo-ui-labelElement-label">Source file</span>
        </legend>
        <label htmlFor="wpUploadFile">Source filename:</label>{" "}
        <input id="wpUploadFile" name="wpUploadFile" type="file" accept={TYPES.join(",")} required onChange={(e) => setDest(e.target.files?.[0]?.name ?? "")} />
        <p className="mw-upload-permitted">Permitted file types: png, gif, jpg, jpeg, webp. Maximum file size: 50 MB.</p>
      </fieldset>
      <fieldset id="mw-htmlform-description" className="oo-ui-layout oo-ui-fieldsetLayout">
        <legend className="oo-ui-fieldsetLayout-header">
          <span className="oo-ui-labelElement-label">File description</span>
        </legend>
        <p>
          <label htmlFor="wpDestFile">Destination filename:</label> <input id="wpDestFile" name="wpDestFile" size={60} value={dest} onChange={(e) => setDest(e.target.value)} required />
        </p>
        <p>
          <label htmlFor="wpUploadDescription">Summary:</label>
          <br />
          <textarea id="wpUploadDescription" name="wpUploadDescription" cols={80} rows={8} className="mw-editfont-monospace" />
        </p>
      </fieldset>
      <div className="mw-htmlform-submit-buttons">
        <SubmitButton label="Upload file" busy={busy} />
      </div>
    </form>
  );
}
