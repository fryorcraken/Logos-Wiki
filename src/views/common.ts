import type { SkinProps } from "@/components/skin.tsx";
import { MAIN_PAGE, SITENAME } from "@/lib/config.ts";
import { actionUrl, pageUrl, type Title } from "@/lib/title.ts";
import { namespaceTabs, pageTools, viewTabs, type Action } from "@/server/chrome.ts";
import type { Context } from "@/server/context.ts";

export type Query = Record<string, string | undefined>;
export type ViewProps = Omit<SkinProps, "viewer" | "returnto" | "printUrl"> & { printPath?: string };

export const docTitle = (text: string) => (text === MAIN_PAGE ? SITENAME : `${text} - ${SITENAME}`);

export function canEdit(ctx: Context, title: Title) {
  return !!ctx.viewer && ctx.wiki.canEdit(ctx.viewer.key, title);
}

export function pageProps(ctx: Context, title: Title, action: Action, props: Partial<ViewProps> & { content: string; heading: string }): ViewProps {
  const latest = ctx.wiki.latest(title.full);
  return {
    docTitle: docTitle(title.full),
    namespaceTabs: namespaceTabs(ctx.wiki, title),
    viewTabs: viewTabs(ctx.wiki, title, action, canEdit(ctx, title)),
    tools: pageTools(ctx.wiki, title, latest?.id),
    printPath: latest ? actionUrl(title.full, { oldid: latest.id }) : pageUrl(title.full),
    ...props,
  };
}

export function specialProps(heading: string, content: string, props: Partial<ViewProps> = {}): ViewProps {
  return { docTitle: docTitle(heading), heading, content, tools: pageTools({} as never, null), ...props };
}

export function finish(ctx: Context, props: ViewProps, returnto: string): SkinProps {
  const { printPath = "/", ...rest } = props;
  return { ...rest, viewer: ctx.viewer, returnto, printUrl: `${ctx.origin}${printPath}` };
}

export const permalink = (title: Title, id: number) => actionUrl(title.full, { oldid: id });
