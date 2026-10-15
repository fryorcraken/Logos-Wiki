import { verify, type Verified } from "@/lib/events.ts";
import { canonicalTitle, validUsername, type Wiki } from "@/lib/state.ts";
import { clientIp, fail, json, limited, readJson } from "@/server/api.ts";
import { gateway } from "@/server/gateway.ts";

const MAX_BODY = 1024 * 1024;
const CLOCK_SKEW = 10 * 60_000;

function rejection(wiki: Wiki, event: Verified) {
  switch (event.t) {
    case "account": {
      const name = validUsername(event.name);
      if (!name || name !== event.name) return "The username is invalid.";
      if (wiki.accounts.has(name)) return "Username entered already in use. Please choose a different name.";
      if (wiki.reserved.has(name) && event.by !== wiki.admin) return "This username is reserved.";
      return wiki.names.has(event.by) ? "This key already belongs to an account." : null;
    }
    case "edit": {
      const title = canonicalTitle(event.title);
      if (!title) return "The page title is invalid.";
      if (!wiki.canEdit(event.by, title)) return "You do not have permission to edit this page.";
      return wiki.latest(title.full)?.text === event.text ? "Nothing was changed." : null;
    }
    case "trust":
      return event.by === wiki.admin ? null : "Only the administrator can change the trusted editors list.";
    case "file":
      return wiki.canUpload(event.by) ? null : "You do not have permission to upload files.";
  }
}

export async function POST(request: Request) {
  if (limited(`ip:${await clientIp()}`, 120)) return fail("Too many requests. Please wait a minute.", 429);
  const body = await readJson(request, MAX_BODY);
  const event = verify(body);
  if (!body || !event) return fail("The change could not be verified.");
  const gw = await gateway();
  const { wiki } = gw;
  if (wiki.has(event.id)) return json({ id: event.id });
  const admin = event.by === wiki.admin;
  if (!admin && Math.abs(Date.now() - event.ts) > CLOCK_SKEW) return fail("Your clock is out of sync. Please check your system time.");
  if (!admin && limited(`key:${event.by}`, 30)) return fail("You are making changes too quickly. Please wait a minute.", 429);
  if (event.t === "edit" && typeof body.base === "number" && (wiki.latest(event.title)?.id ?? 0) !== body.base) {
    return fail("Edit conflict: someone else has changed this page since you started editing it. Copy your text, reload the page and apply your changes again.", 409);
  }
  const reason = rejection(wiki, event);
  if (reason) return fail(reason, 403);
  if (!gw.ingest({ data: body.data, sig: body.sig }, true)) return fail("The change could not be saved.", 422);
  return json({ id: event.id });
}
