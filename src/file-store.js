import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { EMPTY, storeFrom } from "./store.js";

export async function createFileStore(path) {
  return storeFrom(async () => {
    try { return { ...EMPTY, ...JSON.parse(await readFile(path, "utf8")) }; } catch (error) {
      if (error.code === "ENOENT") return structuredClone(EMPTY);
      throw new Error(`Could not read ${path}: ${error.message}`);
    }
  }, async (next) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.tmp`, JSON.stringify(next, null, 2));
    await rename(`${path}.tmp`, path);
  });
}
