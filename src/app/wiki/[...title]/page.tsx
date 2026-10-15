import { safeDecode } from "@/lib/title.ts";
import { firstValue, renderTitle } from "@/views/render.tsx";

type Props = { params: Promise<{ title: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function WikiPage({ params, searchParams }: Props) {
  const [{ title }, query] = await Promise.all([params, searchParams]);
  return renderTitle(title.map(safeDecode).join("/"), firstValue(query));
}
