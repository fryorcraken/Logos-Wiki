"use client";

import { useEffect } from "react";

const ON = "vector-feature-limited-width-clientpref-1";
const OFF = "vector-feature-limited-width-clientpref-0";

function toggle() {
  const root = document.documentElement.classList;
  const limited = root.contains(ON);
  root.replace(limited ? ON : OFF, limited ? OFF : ON);
  root.replace(limited ? "vector-feature-limited-width-content-enabled" : "vector-feature-limited-width-content-disabled", limited ? "vector-feature-limited-width-content-disabled" : "vector-feature-limited-width-content-enabled");
}

function printOnClick(event: MouseEvent) {
  if (!(event.target instanceof Element) || !event.target.closest('a[href="#print"]')) return;
  event.preventDefault();
  print();
}

export function WidthToggle() {
  useEffect(() => {
    document.addEventListener("click", printOnClick);
    return () => document.removeEventListener("click", printOnClick);
  }, []);
  return (
    <button className="cdx-button cdx-button--icon-only vector-limited-width-toggle" onClick={toggle}>
      <span className="vector-icon mw-ui-icon-fullScreen mw-ui-icon-wikimedia-fullScreen" />
      <span>Toggle limited content width</span>
    </button>
  );
}
