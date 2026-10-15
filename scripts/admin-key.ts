import { adminIdentity } from "./admin.ts";

const { name, key } = await adminIdentity();
console.log(`Public key for ${name}. Start the wiki with:\nWIKI_ADMIN_KEY=${key}`);
