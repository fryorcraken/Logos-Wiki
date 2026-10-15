import { redirect } from "next/navigation";
import { MAIN_PAGE } from "@/lib/config.ts";
import { encodeTitle } from "@/lib/title.ts";

export default function Home() {
  redirect(`/wiki/${encodeTitle(MAIN_PAGE)}`);
}
