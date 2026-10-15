import { verifyRequest, sha256Hex } from "@/lib/events.ts";
import { IMAGE_TYPES } from "@/lib/state.ts";
import { fail, json, limited, readBody } from "@/server/api.ts";
import { matchesType, storeBytes } from "@/server/files.ts";
import { gateway } from "@/server/gateway.ts";

const MAX_UPLOAD = 50 * 1024 * 1024;
const WINDOW = 5 * 60_000;

export async function POST(request: Request) {
  const key = request.headers.get("x-wiki-key") ?? "";
  const ts = request.headers.get("x-wiki-ts") ?? "";
  const sig = request.headers.get("x-wiki-sig") ?? "";
  const mime = request.headers.get("content-type") ?? "";
  const { wiki } = await gateway();
  if (!wiki.canUpload(key)) return fail("You do not have permission to upload files.", 403);
  if (Math.abs(Date.now() - Number(ts)) > WINDOW) return fail("The upload request has expired.", 403);
  if (limited(`upload:${key}`, 10)) return fail("Too many uploads. Please wait a minute.", 429);
  if (!IMAGE_TYPES.has(mime)) return fail("Only PNG, JPEG, GIF and WebP images can be uploaded.", 415);
  const bytes = await readBody(request, MAX_UPLOAD);
  if (!bytes) return fail("The file is larger than 50 MB.", 413);
  if (!verifyRequest(key, `upload:${sha256Hex(bytes)}`, ts, sig)) return fail("The upload could not be verified.", 403);
  if (!matchesType(mime, bytes)) return fail("The file contents do not match its type.", 415);
  try {
    return json(await storeBytes(bytes));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Logos Storage is not available.", 503);
  }
}
