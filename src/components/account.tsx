"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { forget, keyFor, publish, remember, returnTo } from "@/client/session.ts";

const MIN_PASSWORD = 10;

type FieldProps = { id: string; name: string; label: string; placeholder: string; tabIndex: number; type?: string; autoComplete: string; help?: string; autoFocus?: boolean };

function Field({ id, name, label, placeholder, tabIndex, type, autoComplete, help, autoFocus }: FieldProps) {
  const cls = name === "wpName" ? "loginText mw-userlogin-username" : `loginPassword${id.startsWith("wpPassword") ? " mw-userlogin-password" : ""}`;
  return (
    <div className={`mw-htmlform-field-HTMLTextField ${cls} cdx-field`}>
      <div className="cdx-label">
        <label className="cdx-label__label" htmlFor={id}>
          <span className="cdx-label__label__text">{label}</span>
        </label>
      </div>
      <div className={`cdx-field__control${help ? " cdx-field__control--has-help-text" : ""}`}>
        <div className="cdx-text-input">
          <input id={id} name={name} size={20} placeholder={placeholder} className={`${cls} cdx-text-input__input`} tabIndex={tabIndex} required autoFocus={autoFocus} autoComplete={autoComplete} type={type} />
        </div>
      </div>
      {help && <div className="cdx-field__help-text htmlform-tip">{help}</div>}
    </div>
  );
}

function Submit({ id, label, tabIndex, busy }: { id: string; label: string; tabIndex: number; busy: boolean }) {
  return (
    <div className="mw-htmlform-field-HTMLSubmitField cdx-field">
      <div className="cdx-field__control">
        <button className="mw-htmlform-submit cdx-button cdx-button--weight-primary cdx-button--action-progressive" id={id} type="submit" tabIndex={tabIndex} disabled={busy}>
          {busy ? "Please wait…" : label}
        </button>
      </div>
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="cdx-message cdx-message--block cdx-message--error" role="alert">
      <span className="cdx-message__icon" />
      <div className="cdx-message__content">{children}</div>
    </div>
  );
}

const normalize = (name: string) => {
  const s = name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function useSubmit(action: (data: FormData) => Promise<string | null>) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const message = await action(new FormData(event.currentTarget));
    if (message) {
      setError(message);
      setBusy(false);
    }
  };
  return { error, busy, onSubmit };
}

export function LoginForm({ prompt, sitename, returnto }: { prompt: string; sitename: string; returnto: string }) {
  const { error, busy, onSubmit } = useSubmit(async (data) => {
    const name = normalize(String(data.get("wpName")));
    const { seed, key } = await keyFor(name, String(data.get("wpPassword")));
    const session = await fetch(`/api/session?key=${key}`).then((r) => r.json(), () => ({}));
    if (session.name !== name) return "Incorrect username or password entered. Please try again.";
    remember(seed, data.get("wpRemember") === "1");
    returnTo(returnto);
    return null;
  });
  return (
    <div className="mw-ui-container">
      {prompt && <div id="userloginprompt" dangerouslySetInnerHTML={{ __html: prompt }} />}
      <div id="userloginForm">
        <form className="mw-htmlform mw-htmlform-codex" name="userlogin" onSubmit={onSubmit}>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Field id="wpName1" name="wpName" label="Username" placeholder="Enter your username" tabIndex={1} autoComplete="username" autoFocus />
          <Field id="wpPassword1" name="wpPassword" label="Password" placeholder="Enter your password" tabIndex={2} type="password" autoComplete="current-password" />
          <div className="mw-htmlform-field-HTMLCheckField mw-userlogin-rememberme cdx-field">
            <div className="cdx-field__control">
              <div className="cdx-checkbox">
                <input name="wpRemember" type="checkbox" value="1" id="wpRemember" tabIndex={3} className="mw-userlogin-rememberme cdx-checkbox__input" />
                <span className="cdx-checkbox__icon"> </span>
                <label htmlFor="wpRemember" className="cdx-checkbox__label">
                  Keep me logged in
                </label>
              </div>
            </div>
          </div>
          <Submit id="wpLoginAttempt" label="Log in" tabIndex={4} busy={busy} />
          <div className="mw-htmlform-field-HTMLInfoField mw-form-related-link-container mw-userlogin-help cdx-field">
            <div className="cdx-field__control">
              <a href="https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Logging_in">Help with logging in</a>
            </div>
          </div>
          <div className="mw-htmlform-field-HTMLInfoField cdx-field">
            <div className="cdx-field__control">
              <div id="mw-createaccount-cta" className="mw-ui-vform-field">
                Don&apos;t have an account?
                <a id="mw-createaccount-join" href={`/wiki/Special:CreateAccount${returnto ? `?returnto=${encodeURIComponent(returnto)}` : ""}`} className="cdx-button cdx-button--action-progressive cdx-button--fake-button cdx-button--fake-button--enabled" tabIndex={100}>
                  Join {sitename}
                </a>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

type Stats = { edits: number; articles: number; recent: number };

function Benefit({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div className={`mw-number-text icon-${icon}`}>
      <h3>{value.toLocaleString("en")}</h3>
      <p>{label}</p>
    </div>
  );
}

export function CreateAccountForm({ sitename, returnto, stats }: { sitename: string; returnto: string; stats: Stats }) {
  const { error, busy, onSubmit } = useSubmit(async (data) => {
    const name = normalize(String(data.get("wpName")));
    const password = String(data.get("wpPassword"));
    if (password !== data.get("retype")) return "The passwords you entered do not match.";
    if (password.length < MIN_PASSWORD) return `Passwords must be at least ${MIN_PASSWORD} characters.`;
    const { seed } = await keyFor(name, password);
    const result = await publish({ t: "account", name }, {}, seed);
    if (!result.ok) return result.error;
    remember(seed, false);
    returnTo(returnto);
    return null;
  });
  return (
    <div className="mw-ui-container">
      <div id="userloginForm">
        <form className="mw-htmlform mw-htmlform-codex" id="userlogin2" name="userlogin2" onSubmit={onSubmit}>
          <div className="mw-htmlform-field-HTMLInfoField cdx-field">
            <div className="cdx-field__control">
              <div id="mw-createacct-status-area">{error && <ErrorBox>{error}</ErrorBox>}</div>
            </div>
          </div>
          <Field id="wpName2" name="wpName" label="Username" placeholder="Enter your username" tabIndex={2} autoComplete="username" />
          <Field id="wpPassword2" name="wpPassword" label="Password" placeholder="Enter a password" tabIndex={3} type="password" autoComplete="new-password" help="Your password is your key: it cannot be reset, so store it safely. Use a unique password of at least 10 characters." />
          <Field id="wpRetype" name="retype" label="Confirm password" placeholder="Enter password again" tabIndex={4} type="password" autoComplete="new-password" />
          <Submit id="wpCreateaccount" label="Create your account" tabIndex={6} busy={busy} />
        </form>
      </div>
      <div className="mw-createacct-benefits-container">
        <h2>{sitename} is made by people like you.</h2>
        <div className="mw-createacct-benefits-list">
          <Benefit icon="edits" value={stats.edits} label="edits" />
          <Benefit icon="pages" value={stats.articles} label="pages" />
          <Benefit icon="contributors" value={stats.recent} label={stats.recent === 1 ? "recent contributor" : "recent contributors"} />
        </div>
      </div>
    </div>
  );
}

export function LogoutForm({ returnto }: { returnto: string }) {
  const [done, setDone] = useState(false);
  if (done) return <p>You are now logged out.</p>;
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    forget();
    setDone(true);
    returnTo(returnto);
  };
  return (
    <form className="mw-htmlform mw-htmlform-codex" onSubmit={onSubmit}>
      <p>Do you want to log out?</p>
      <Submit id="wpLogout" label="Log out" tabIndex={1} busy={false} />
    </form>
  );
}
