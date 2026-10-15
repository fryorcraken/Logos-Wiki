export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { gateway } = await import("./server/gateway.ts");
  await gateway();
}
