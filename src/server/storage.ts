import { call, on, waitFor, type ModuleEvent } from "./logos.ts";

const MODULE = "storage_module";
const TIMEOUT = 10 * 60_000;

type Done = { success: boolean; sessionId: string; cid?: string; error?: string };
const payload = (event: ModuleEvent): Done => JSON.parse(String(event.data.arg0 ?? "{}"));

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>) {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export async function startStorage() {
  on(MODULE, () => undefined);
  if ((await call(MODULE, "isRunning")) === true) return;
  await call(MODULE, "init", String(await call(MODULE, "loadConfigOrDefault")));
  await call(MODULE, "start");
  if ((await call(MODULE, "isRunning")) !== true) throw new Error("storage_module did not start");
}

export const upload = (path: string) =>
  serial(async () => {
    const done = waitFor(MODULE, (e) => (e.event === "storageUploadDone" ? payload(e) : undefined), TIMEOUT);
    await call(MODULE, "uploadUrl", path, 65536, true);
    const result = await done;
    if (!result.success || !result.cid) throw new Error(`upload failed: ${result.error ?? "unknown"}`);
    return result.cid;
  });

export async function download(cid: string, path: string) {
  const done = waitFor(
    MODULE,
    (e) => (e.event === "storageDownloadDone" && payload(e).sessionId === cid ? payload(e) : undefined),
    TIMEOUT,
  );
  await call(MODULE, "downloadToUrl", cid, path, false, 65536, false, false);
  const result = await done;
  if (!result.success) throw new Error(`download of ${cid} failed: ${result.error ?? "unknown"}`);
}
