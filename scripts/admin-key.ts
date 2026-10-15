import { adminIdentity } from "./admin.ts";

const { name, key } = await adminIdentity();
console.error(`Public key for ${name}. Start the wiki with:`);
console.log(`WIKI_ADMIN_KEY=${key}`);
