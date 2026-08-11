import { rm } from "node:fs/promises";
import path from "node:path";

const workspace = path.resolve(process.cwd());
const target = path.resolve(workspace, ".qai-validation");
const expected = `${workspace}${path.sep}.qai-validation`;

if (target !== expected || path.dirname(target) !== workspace) {
  throw new Error("Refusing to reset a path outside this Qai workspace.");
}

await rm(target, { recursive: true, force: true });
console.log("Local Qai validation data reset.");
