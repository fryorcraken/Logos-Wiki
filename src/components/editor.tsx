"use client";

import { useState } from "react";
import { post, publish } from "@/client/session.ts";
import { appendSection, replaceSection } from "@/lib/sections.ts";
import type { EditorState } from "@/views/actions.ts";
import { ErrorBox } from "./account.tsx";

type Panel = { kind: "preview" | "diff"; html: string } | null;

const pageHref = (title: string) => `/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":")}`;

function fullText(state: EditorState, text: string, summary: string) {
  if (state.section === "new") return appendSection(state.original, summary, text);
  if (state.section) return replaceSection(state.original, Number(state.section), text);
  return text;
}

function PreviewPanel({ panel }: { panel: NonNullable<Panel> }) {
  if (panel.kind === "diff") {
    return (
      <div id="wikiDiff">
        <table className="diff diff-type-table diff-contentalign-left diff-editfont-monospace">
          <colgroup>
            <col className="diff-marker" />
            <col className="diff-content" />
            <col className="diff-marker" />
            <col className="diff-content" />
          </colgroup>
          <tbody>
            <tr className="diff-title">
              <td colSpan={2} className="diff-otitle diff-side-deleted">Latest revision</td>
              <td colSpan={2} className="diff-ntitle diff-side-added">Your text</td>
            </tr>
          </tbody>
          <tbody dangerouslySetInnerHTML={{ __html: panel.html }} />
        </table>
      </div>
    );
  }
  return (
    <div id="wikiPreview" className="ontop">
      <div className="previewnote">
        <h2 id="mw-previewheader">Preview</h2>
        <div className="mw-message-box cdx-message cdx-message--block mw-message-box-warning cdx-message--warning">
          <span className="cdx-message__icon" />
          <div className="cdx-message__content">
            <p>
              <strong>Remember that this is only a preview.</strong> Your changes have not yet been saved! <a href="#editform">→ Go to editing area</a>
            </p>
          </div>
        </div>
      </div>
      <div className="mw-content-ltr mw-parser-output" lang="en" dir="ltr" dangerouslySetInnerHTML={{ __html: panel.html }} />
    </div>
  );
}

function Button({ id, label, primary, onClick, busy, accessKey, title }: { id: string; label: string; primary?: boolean; onClick: () => void; busy: boolean; accessKey: string; title: string }) {
  const flags = primary ? " oo-ui-flaggedElement-progressive oo-ui-flaggedElement-primary" : "";
  return (
    <span id={id} className={`oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-buttonElement oo-ui-buttonElement-framed oo-ui-labelElement${flags} oo-ui-buttonInputWidget`}>
      <button type="button" className="oo-ui-inputWidget-input oo-ui-buttonElement-button" onClick={onClick} disabled={busy} accessKey={accessKey} title={title}>
        <span className="oo-ui-labelElement-label">{label}</span>
      </button>
    </span>
  );
}

export function Editor({ state }: { state: EditorState }) {
  const [text, setText] = useState(state.text);
  const [summary, setSummary] = useState(state.summary);
  const [minor, setMinor] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const message = await task();
    setError(message);
    setBusy(false);
  };

  const show = (kind: "preview" | "diff") =>
    run(async () => {
      const body = kind === "diff" ? { title: state.title, text: fullText(state, text, summary) ?? text, diff: true } : { title: state.title, text };
      const result = await post("/api/preview", body);
      if (!result.ok) return result.error;
      setPanel({ kind, html: (result.data as { html: string }).html });
      return null;
    });

  const save = () =>
    run(async () => {
      const heading = state.section === "new" ? summary.trim() : "";
      const full = fullText(state, text, heading);
      if (full === null) return "The section you are editing could not be found.";
      const edit = { t: "edit" as const, title: state.title, text: full, summary: heading ? `/* ${heading} */ new section` : summary, minor };
      const result = await publish(edit, { base: state.base });
      if (!result.ok) return result.error;
      location.assign(pageHref(state.title));
      return null;
    });

  return (
    <>
      {panel && <PreviewPanel panel={panel} />}
      <form id="editform" name="editform" onSubmit={(e) => (e.preventDefault(), save())}>
        {error && <ErrorBox>{error}</ErrorBox>}
        <textarea tabIndex={1} accessKey="," id="wpTextbox1" cols={80} rows={25} className="mw-editfont-monospace" lang="en" dir="ltr" name="wpTextbox1" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="editOptions">
          <div id="wpSummaryWidget" className="oo-ui-layout oo-ui-labelElement oo-ui-fieldLayout oo-ui-fieldLayout-align-top">
            <div className="oo-ui-fieldLayout-body">
              <span className="oo-ui-fieldLayout-header">
                <label htmlFor="wpSummary" className="oo-ui-labelElement-label">{state.section === "new" ? "Subject:" : "Summary:"}</label>
              </span>
              <div className="oo-ui-fieldLayout-field">
                <div className="oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-textInputWidget oo-ui-textInputWidget-type-text">
                  <input id="wpSummary" name="wpSummary" maxLength={500} tabIndex={1} accessKey="b" title="Enter a short summary [b]" spellCheck className="oo-ui-inputWidget-input mw-summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <div className="editCheckboxes">
            <div className="oo-ui-layout oo-ui-horizontalLayout">
              <label className="oo-ui-layout oo-ui-labelElement oo-ui-fieldLayout oo-ui-fieldLayout-align-inline" htmlFor="wpMinoredit">
                <span className="oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-checkboxInputWidget">
                  <input type="checkbox" id="wpMinoredit" name="wpMinoredit" accessKey="i" checked={minor} onChange={(e) => setMinor(e.target.checked)} className="oo-ui-inputWidget-input" />
                  <span className="oo-ui-checkboxInputWidget-checkIcon oo-ui-iconElement-icon oo-ui-icon-check oo-ui-image-invert" />
                </span>
                <span className="oo-ui-labelElement-label"> This is a minor edit</span>
              </label>
            </div>
          </div>
          <div className="mw-editTools" />
          <div className="editButtons">
            <Button id="wpSaveWidget" label={state.creating ? "Save page" : "Save changes"} primary onClick={save} busy={busy} accessKey="s" title="Save your changes [s]" />
            <Button id="wpPreviewWidget" label="Show preview" onClick={() => show("preview")} busy={busy} accessKey="p" title="Preview your changes. Please use this before saving! [p]" />
            <Button id="wpDiffWidget" label="Show changes" onClick={() => show("diff")} busy={busy} accessKey="v" title="Show which changes you made to the text [v]" />
            <span className="cancelLink">
              <a href={pageHref(state.title)} className="oo-ui-buttonElement-button">Cancel</a>
            </span>
            <span className="editHelp">
              <a href="https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Editing_pages" target="helpwindow">Editing help</a> (opens in new window)
            </span>
          </div>
        </div>
      </form>
    </>
  );
}
