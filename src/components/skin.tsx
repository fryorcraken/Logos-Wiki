import type { ReactNode } from "react";
import { SITENAME, MAIN_PAGE } from "@/lib/config.ts";
import { actionUrl, pageUrl } from "@/lib/title.ts";
import type { Heading } from "@/lib/wikitext/blocks.ts";
import { formatDate, formatTime } from "@/lib/format.ts";
import { escapeHtml } from "@/lib/wikitext/sanitize.ts";
import { Dropdown, Icon, PinnableHeader, Portlet, type Item } from "./vector.tsx";
import { WidthToggle } from "./width-toggle.tsx";

export type Viewer = { name: string; key: string; exists: boolean; talkExists: boolean } | null;

export type SkinProps = {
  docTitle: string;
  heading: string;
  viewer: Viewer;
  returnto: string;
  content: string;
  namespaceTabs?: Item[];
  viewTabs?: Item[];
  tools?: Item[];
  toc?: Heading[];
  subtitle?: string;
  indicators?: string;
  mainPage?: boolean;
  siteSub?: boolean;
  lastmod?: number;
  catlinks?: string;
  printUrl: string;
  wide?: boolean;
  restricted?: boolean;
  children?: ReactNode;
};

const NAVIGATION: Item[] = [
  { id: "n-mainpage-description", text: "Main page", href: pageUrl(MAIN_PAGE), title: "Visit the main page [z]", accessKey: "z" },
  { id: "n-recentchanges", text: "Recent changes", href: "/wiki/Special:RecentChanges", title: "A list of recent changes in the wiki [r]", accessKey: "r" },
  { id: "n-randompage", text: "Random page", href: "/wiki/Special:Random", title: "Load a random page [x]", accessKey: "x" },
  { id: "n-help-mediawiki", text: "Help about MediaWiki", href: "https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Contents" },
];

function MainMenu() {
  return (
    <Dropdown id="vector-main-menu-dropdown" label="Main menu" icon="menu" className="vector-main-menu-dropdown vector-button-flush-left vector-button-flush-right">
      <div id="vector-main-menu-unpinned-container" className="vector-unpinned-container">
        <div id="vector-main-menu" className="vector-main-menu vector-pinnable-element">
          <PinnableHeader name="main-menu" label="Main menu" pinned={false} />
          <Portlet id="p-navigation" heading="Navigation" items={NAVIGATION} />
        </div>
      </div>
    </Dropdown>
  );
}

function Search() {
  const label = `Search ${SITENAME}`;
  return (
    <div id="p-search" role="search" className="vector-search-box-vue vector-search-box-collapses vector-search-box-show-thumbnail vector-search-box-auto-expand-width vector-search-box">
      <a href="/wiki/Special:Search" className="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet cdx-button--icon-only search-toggle" title={`${label} [f]`} accessKey="f">
        <Icon name="search" />
        <span>Search</span>
      </a>
      <div className="vector-typeahead-search-container">
        <div className="cdx-typeahead-search cdx-typeahead-search--show-thumbnail cdx-typeahead-search--auto-expand-width">
          <form action="/index.php" id="searchform" className="cdx-search-input cdx-search-input--has-end-button">
            <div id="simpleSearch" className="cdx-search-input__input-wrapper" data-search-loc="header-moved">
              <div className="cdx-text-input cdx-text-input--has-start-icon">
                <input className="cdx-text-input__input" type="search" name="search" placeholder={label} aria-label={label} autoCapitalize="sentences" title={`${label} [f]`} accessKey="f" id="searchInput" />
                <span className="cdx-text-input__icon cdx-text-input__start-icon" />
              </div>
              <input type="hidden" name="title" value="Special:Search" />
            </div>
            <button className="cdx-button cdx-search-input__end-button">Search</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function userItems(viewer: Viewer, returnto: string) {
  const query: Record<string, string> = returnto ? { returnto } : {};
  if (!viewer) {
    const create = { text: "Create account", href: actionUrl("Special:CreateAccount", query), title: "You are encouraged to create an account and log in; however, it is not mandatory" };
    const login = { text: "Log in", href: actionUrl("Special:UserLogin", query), title: "You are encouraged to log in; however, it is not mandatory [o]", accessKey: "o" };
    return {
      header: [],
      overflow: [
        { ...create, id: "pt-createaccount-2", className: "user-links-collapsible-item" },
        { ...login, id: "pt-login-2", className: "user-links-collapsible-item" },
      ],
      personal: [
        { ...create, id: "pt-createaccount", className: "user-links-collapsible-item", icon: "userAdd" },
        { ...login, id: "pt-login", className: "user-links-collapsible-item", icon: "logIn" },
      ],
      logout: [],
    };
  }
  const user = `User:${viewer.name}`;
  const userLink = (exists: boolean, full: string) => (exists ? pageUrl(full) : actionUrl(full, { action: "edit", redlink: 1 }));
  const page = { text: viewer.name, href: userLink(viewer.exists, user), title: "Your user page [.]", accessKey: ".", linkClass: viewer.exists ? undefined : "new" };
  return {
    header: [{ ...page, id: "pt-userpage-2", className: "user-links-collapsible-item" }],
    overflow: [],
    personal: [
      { ...page, id: "pt-userpage", className: "user-links-collapsible-item", icon: "userAvatar" },
      { id: "pt-mytalk", text: "Talk", href: userLink(viewer.talkExists, `User talk:${viewer.name}`), title: "Your talk page [n]", accessKey: "n", icon: "userTalk", linkClass: viewer.talkExists ? undefined : "new" },
      { id: "pt-mycontris", text: "Contributions", href: `/wiki/Special:Contributions/${encodeURIComponent(viewer.name.replace(/ /g, "_"))}`, title: "A list of your contributions [y]", accessKey: "y", icon: "userContributions" },
    ],
    logout: [{ id: "pt-logout", text: "Log out", href: actionUrl("Special:UserLogout", query), title: "Log out", icon: "logOut" }],
  };
}

function UserLinks({ viewer, returnto }: { viewer: Viewer; returnto: string }) {
  const items = userItems(viewer, returnto);
  return (
    <nav className="vector-user-links vector-user-links-wide" aria-label="Personal tools">
      <div className="vector-user-links-main">
        <Portlet id="p-vector-user-menu-preferences" items={[]} />
        <Portlet id="p-vector-user-menu-userpage" items={items.header} />
        <nav className="vector-client-prefs-landmark" aria-label="Appearance" />
        <Portlet id="p-vector-user-menu-notifications" items={[]} />
        <Portlet id="p-vector-user-menu-overflow" items={items.overflow} />
      </div>
      <Dropdown
        id="vector-user-links-dropdown"
        label="Personal tools"
        icon={viewer ? "userAvatar" : "ellipsis"}
        title="More options"
        className={`vector-user-menu vector-button-flush-right ${viewer ? "vector-user-menu-logged-in" : "vector-user-menu-logged-out user-links-collapsible-item"}`}
      >
        <Portlet id="p-personal" items={items.personal} title="User menu" className="user-links-collapsible-item" />
        {viewer && <Portlet id="p-user-menu-logout" items={items.logout} />}
      </Dropdown>
    </nav>
  );
}

function Header({ viewer, returnto }: { viewer: Viewer; returnto: string }) {
  return (
    <div className="vector-header-container">
      <header className="vector-header mw-header">
        <div className="vector-header-start">
          <nav className="vector-main-menu-landmark" aria-label="Site">
            <MainMenu />
          </nav>
          <a href={pageUrl(MAIN_PAGE)} className="mw-logo">
            <img className="mw-logo-icon" src="/assets/lan-logo.svg" alt="" aria-hidden="true" height={50} width={50} />
            <span className="mw-logo-container">
              <img className="mw-logo-wordmark" alt={SITENAME} src="/assets/lan-wordmark.png" style={{ width: "10em", height: "0.8125em" }} />
            </span>
          </a>
        </div>
        <div className="vector-header-end">
          <Search />
          <UserLinks viewer={viewer} returnto={returnto} />
        </div>
      </header>
    </div>
  );
}

function tocTree(headings: Heading[]) {
  type Node = { heading: Heading; children: Node[] };
  const root: Node[] = [];
  const stack: Node[] = [];
  for (const heading of headings) {
    const node = { heading, children: [] };
    while (stack.length && stack.at(-1)!.heading.toclevel >= heading.toclevel) stack.pop();
    (stack.at(-1)?.children ?? root).push(node);
    stack.push(node);
  }
  const render = (nodes: Node[]) =>
    nodes.map(({ heading, children }) => (
      <li key={heading.anchor} id={`toc-${heading.anchor}`} className={`vector-toc-list-item vector-toc-level-${heading.toclevel}${heading.toclevel === 1 ? " vector-toc-list-item-expanded" : ""}`}>
        <a className="vector-toc-link" href={`#${heading.anchor}`}>
          <div className="vector-toc-text">
            <span className="vector-toc-numb">{heading.number}</span>
            <span dangerouslySetInnerHTML={{ __html: heading.text }} />
          </div>
        </a>
        <ul id={`toc-${heading.anchor}-sublist`} className="vector-toc-list">
          {render(children)}
        </ul>
      </li>
    ));
  return render(root);
}

function Toc({ headings }: { headings: Heading[] }) {
  return (
    <div className="vector-sticky-pinned-container">
      <nav id="mw-panel-toc" aria-label="Contents" className="mw-table-of-contents-container vector-toc-landmark">
        <div id="vector-toc-pinned-container" className="vector-pinned-container">
          <div id="vector-toc" className="vector-toc vector-pinnable-element">
            <PinnableHeader name="toc" label="Contents" pinned heading />
            <ul className="vector-toc-contents" id="mw-panel-toc-list">
              <li id="toc-mw-content-text" className="vector-toc-list-item vector-toc-level-1">
                <a href="#" className="vector-toc-link">
                  <div className="vector-toc-text">Beginning</div>
                </a>
              </li>
              {tocTree(headings)}
            </ul>
          </div>
        </div>
      </nav>
    </div>
  );
}

function TitlebarToc() {
  return (
    <nav aria-label="Contents" className="vector-toc-landmark">
      <Dropdown id="vector-page-titlebar-toc" label="Toggle the table of contents" icon="listBullet" className="vector-page-titlebar-toc vector-button-flush-left">
        <div id="vector-page-titlebar-toc-unpinned-container" className="vector-unpinned-container" />
      </Dropdown>
    </nav>
  );
}

function PageToolbar({ namespaceTabs, viewTabs, tools }: { namespaceTabs: Item[]; viewTabs: Item[]; tools: Item[] }) {
  const more = viewTabs.map((tab) => ({
    ...tab,
    id: tab.id.replace(/^ca-/, "ca-more-"),
    className: `${tab.className?.includes("selected") ? "selected " : ""}vector-more-collapsible-item`,
    title: undefined,
    accessKey: undefined,
  }));
  return (
    <div className="vector-page-toolbar">
      <div className="vector-page-toolbar-container">
        <div id="left-navigation">
          <nav aria-label="Namespaces">
            <Portlet id="p-associated-pages" items={namespaceTabs} className="vector-menu-tabs" />
          </nav>
        </div>
        <div id="right-navigation" className="vector-collapsible">
          <nav aria-label="Views">
            <Portlet id="p-views" items={viewTabs} className="vector-menu-tabs" />
          </nav>
          {tools.length > 0 && (
            <nav className="vector-page-tools-landmark" aria-label="Page tools">
              <Dropdown id="vector-page-tools-dropdown" label="Tools" className="vector-page-tools-dropdown">
                <div id="vector-page-tools-unpinned-container" className="vector-unpinned-container">
                  <div id="vector-page-tools" className="vector-page-tools vector-pinnable-element">
                    <PinnableHeader name="page-tools" label="Tools" pinned={false} />
                    <Portlet id="p-cactions" heading="Actions" items={more} title="More options" className="vector-has-collapsible-items" />
                    <Portlet id="p-tb" heading="General" items={tools} />
                  </div>
                </div>
              </Dropdown>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

function Footer({ lastmod }: { lastmod?: number }) {
  const project = (page: string) => pageUrl(`${SITENAME}:${page}`);
  return (
    <div className="mw-footer-container">
      <footer id="footer" className="mw-footer">
        <ul id="footer-info">
          {lastmod !== undefined && (
            <li id="footer-info-lastmod">
              {" "}
              This page was last edited on {formatDate(lastmod)}, at {formatTime(lastmod)}.
            </li>
          )}
        </ul>
        <ul id="footer-places">
          <li id="footer-places-privacy">
            <a href={project("Privacy policy")}>Privacy policy</a>
          </li>
          <li id="footer-places-about">
            <a href={project("About")}>About {SITENAME}</a>
          </li>
          <li id="footer-places-disclaimers">
            <a href={project("General disclaimer")}>Disclaimers</a>
          </li>
        </ul>
        <ul id="footer-icons" className="noprint">
          <li id="footer-poweredbyico">
            <a href="https://logos.co/">
              <img src="/assets/poweredby_logos.svg" alt="Powered by Logos" width={88} height={31} loading="lazy" />
            </a>
          </li>
        </ul>
      </footer>
    </div>
  );
}

const printFooter = (url: string) => `<div class="printfooter" data-nosnippet="">Retrieved from "<a dir="ltr" href="${escapeHtml(url)}">${escapeHtml(url)}</a>"</div>`;

const Indicators = ({ html = "" }: { html?: string }) => <div className="mw-indicators" dangerouslySetInnerHTML={{ __html: html }} />;

export function Skin(props: SkinProps) {
  const { viewer, returnto, toc = [], namespaceTabs = [], viewTabs = [], tools = [] } = props;
  const hasToc = toc.length > 0;
  return (
    <>
      <title>{props.docTitle}</title>
      <link rel="stylesheet" href="/skin/vector.css" precedence="skin" />
      <link rel="stylesheet" href="/skin/interface.css" precedence="skin" />
      <link rel="stylesheet" href="/skin/wiki.css" precedence="skin" />
      {!props.restricted && <link rel="stylesheet" href="/site.css" precedence="site" />}
      <a className="mw-jump-link" href="#bodyContent">
        Jump to content
      </a>
      <Header viewer={viewer} returnto={returnto} />
      <div className={`mw-page-container ${hasToc ? "vector-toc-available" : "vector-toc-not-available"}${props.wide ? " vector-feature-limited-width-content-disabled" : ""}`}>
        <div className="mw-page-container-inner">
          <div className="vector-sitenotice-container">
            <div id="siteNotice" />
          </div>
          <div className="vector-column-start">
            <div className="vector-main-menu-container">
              <div id="mw-navigation">
                <nav id="mw-panel" className="vector-main-menu-landmark" aria-label="Site">
                  <div id="vector-main-menu-pinned-container" className="vector-pinned-container" />
                </nav>
              </div>
            </div>
            {hasToc && <Toc headings={toc} />}
          </div>
          <div className="mw-content-container">
            <main id="content" className="mw-body">
              <header className="mw-body-header vector-page-titlebar">
                {hasToc && <TitlebarToc />}
                <h1 id="firstHeading" className="firstHeading mw-first-heading" dangerouslySetInnerHTML={{ __html: props.heading }} />
                {props.mainPage && <Indicators html={props.indicators} />}
              </header>
              <PageToolbar namespaceTabs={namespaceTabs} viewTabs={viewTabs} tools={tools} />
              <div className="vector-column-end">
                <div className="vector-sticky-pinned-container">
                  <nav className="vector-page-tools-landmark" aria-label="Page tools">
                    <div id="vector-page-tools-pinned-container" className="vector-pinned-container" />
                  </nav>
                  <nav className="vector-client-prefs-landmark" aria-label="Appearance" />
                </div>
              </div>
              <div id="bodyContent" className="vector-body" aria-labelledby="firstHeading">
                <div className="vector-body-before-content">
                  {!props.mainPage && props.indicators !== undefined && <Indicators html={props.indicators} />}
                  {props.siteSub && (
                    <div id="siteSub" className="noprint">
                      From {SITENAME}
                    </div>
                  )}
                </div>
                <div id="contentSub">
                  <div id="mw-content-subtitle" dangerouslySetInnerHTML={{ __html: props.subtitle ?? "" }} />
                </div>
                {props.children ? (
                  <div id="mw-content-text" className="mw-body-content">
                    {props.content && <div className="mw-contents" dangerouslySetInnerHTML={{ __html: props.content }} />}
                    {props.children}
                    <div className="mw-contents" dangerouslySetInnerHTML={{ __html: printFooter(props.printUrl) }} />
                  </div>
                ) : (
                  <div id="mw-content-text" className="mw-body-content" dangerouslySetInnerHTML={{ __html: props.content + printFooter(props.printUrl) }} />
                )}
                <div id="catlinks" className={props.catlinks ? "catlinks" : "catlinks catlinks-allhidden"} data-mw="interface" dangerouslySetInnerHTML={{ __html: props.catlinks ?? "" }} />
              </div>
            </main>
          </div>
          <Footer lastmod={props.lastmod} />
        </div>
      </div>
      <div className="vector-settings" id="p-dock-bottom">
        <ul>
          <li>
            <WidthToggle />
          </li>
        </ul>
      </div>
    </>
  );
}
