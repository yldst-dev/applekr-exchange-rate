import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CatalogStore } from "../../src/application/ports.js";
import {
  emptyCatalog,
  type CatalogSnapshot,
} from "../../src/domain/catalog.js";
export class FileCatalogStore implements CatalogStore {
  constructor(private readonly directory: string) {}
  async read(): Promise<CatalogSnapshot> {
    try {
      const data = JSON.parse(
        await readFile(join(this.directory, "catalog.json"), "utf8"),
      );
      if (data.version !== 1 || !Array.isArray(data.products))
        throw new Error("저장된 데이터 형식이 올바르지 않습니다.");
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyCatalog();
      throw error;
    }
  }
  async write(snapshot: CatalogSnapshot) {
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, "catalog.json.tmp");
    await writeFile(temporary, JSON.stringify(snapshot), { mode: 0o600 });
    await rename(temporary, join(this.directory, "catalog.json"));
  }
}
