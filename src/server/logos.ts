import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { LOGOSCTL } from "../lib/config.ts";

const run = promisify(execFile);

export type ModuleEvent = { event: string; data: Record<string, unknown> };
type Listener = (event: ModuleEvent) => void;

function unwrap(result: unknown) {
  if (result && typeof result === "object" && "success" in result) {
    const { success, value, error } = result as { success: boolean; value: unknown; error: unknown };
    if (!success) throw new Error(String(error));
    return value;
  }
  return result;
}

export async function call(module: string, method: string, ...args: (string | number | boolean)[]) {
  const { stdout } = await run(LOGOSCTL, ["--json", "call", module, method, ...args.map(String)], {
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const reply = JSON.parse(stdout);
  if (reply.status !== "ok") throw new Error(`${module}.${method}: ${reply.message ?? stdout}`);
  return unwrap(reply.result);
}

export async function ctl(...args: string[]) {
  const { stdout } = await run(LOGOSCTL, ["--json", ...args], { timeout: 120_000 });
  return JSON.parse(stdout);
}

const listeners = new Map<string, Set<Listener>>();

function watch(module: string) {
  const child = spawn(LOGOSCTL, ["--json", "watch", module], { stdio: ["ignore", "pipe", "ignore"] });
  createInterface({ input: child.stdout }).on("line", (line) => {
    let event: ModuleEvent;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    for (const listener of listeners.get(module) ?? []) listener(event);
  });
  child.on("exit", () => setTimeout(() => watch(module), 2000));
}

export function on(module: string, listener: Listener) {
  if (!listeners.has(module)) {
    listeners.set(module, new Set());
    watch(module);
  }
  listeners.get(module)!.add(listener);
  return () => listeners.get(module)!.delete(listener);
}

export function waitFor<T>(module: string, match: (event: ModuleEvent) => T | undefined, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`${module}: timed out`));
    }, timeoutMs);
    const off = on(module, (event) => {
      const value = match(event);
      if (value === undefined) return;
      clearTimeout(timer);
      off();
      resolve(value);
    });
  });
}
