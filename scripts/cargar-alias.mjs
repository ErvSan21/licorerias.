import { register } from "node:module";

register(new URL("./resolver-alias.mjs", import.meta.url).href, import.meta.url);
