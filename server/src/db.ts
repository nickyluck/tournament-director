import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DB_PATH = resolve(__dirname, "..", "data", "db.json");

export class Store {
  private path: string;
  private data: Database;

  constructor(path: string = process.env.DB_PATH ?? DEFAULT_DB_PATH) {
    this.path = path;
    this.data = this.load();
  }

  private load(): Database {
    if (!existsSync(this.path)) {
      return { tournaments: [] };
    }
    try {
      const raw = readFileSync(this.path, "utf-8");
      const parsed = JSON.parse(raw) as Database;
      if (!parsed.tournaments) return { tournaments: [] };
      return parsed;
    } catch {
      return { tournaments: [] };
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.data, null, 2), "utf-8");
  }

  getDatabase(): Database {
    return this.data;
  }

  save(): void {
    this.persist();
  }
}
