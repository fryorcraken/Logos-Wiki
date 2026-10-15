import { redirect } from "next/navigation";
import { MAIN_PAGE } from "@/lib/config.ts";
import { encodeTitle } from "@/lib/title.ts";
import { firstValue, renderTitle } from "@/views/render.tsx";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function IndexPhp({ searchParams }: Props) {
  const query = firstValue(await searchParams);
  if (query.search !== undefined && !query.title) return renderTitle("Special:Search", query);
  if (!query.title && Object.keys(query).length === 0) redirect(`/wiki/${encodeTitle(MAIN_PAGE)}`);
  return renderTitle(query.title ?? MAIN_PAGE, query);
}
