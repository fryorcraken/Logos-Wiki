import { safeDecode } from "@/lib/title.ts";
import { loadFile } from "@/server/files.ts";
import { gateway } from "@/server/gateway.ts";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = safeDecode((await params).name).replace(/_/g, " ");
  const { wiki } = await gateway();
  const file = wiki.files.get(name);
  const bytes = file && (await loadFile(file).catch(() => null));
  if (!file || !bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": file.mime,
      "content-length": String(bytes.length),
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": "public, max-age=86400",
      etag: `"${file.sha}"`,
    },
  });
}
