import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

const HTML_CLASS = [
  "client-js",
  "vector-feature-language-in-header-enabled",
  "vector-feature-language-in-main-page-header-disabled",
  "vector-feature-sticky-header-disabled",
  "vector-feature-page-tools-pinned-disabled",
  "vector-feature-toc-pinned-clientpref-1",
  "vector-feature-main-menu-pinned-disabled",
  "vector-feature-limited-width-clientpref-1",
  "vector-feature-limited-width-content-enabled",
  "vector-feature-custom-font-size-clientpref-0",
  "vector-feature-client-preferences-disabled",
  "vector-feature-client-prefs-pinned-disabled",
  "vector-feature-night-mode-disabled",
  "skin-theme-clientpref-day",
].join(" ");

const BODY_CLASS = "skin-vector skin-vector-search-vue mediawiki ltr sitedir-ltr mw-hide-empty-elt skin-vector-2022 action-view";

export const metadata: Metadata = {
  robots: "max-image-preview:standard",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: 1000 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={HTML_CLASS} suppressHydrationWarning>
      <body className={BODY_CLASS}>{children}</body>
    </html>
  );
}
