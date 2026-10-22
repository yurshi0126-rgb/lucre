import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

export class JsonStore {
  constructor(name, defaults = {}) {
    this.file = path.join(DATA_DIR, `${name}.json`);
    this.defaults = defaults;
    this.data = {};
    this._dirty = false;
    this._timer = null;
    this._load();
  }

  _load() {
    try {
      if (existsSync(this.file)) this.data = JSON.parse(readFileSync(this.file, 'utf8')) || {};
    } catch (e) {
      console.error(`[lucre] could not read ${this.file}:`, e.message);
      this.data = {};
    }
  }

  /** The whole settings object of one server (created empty on first use). */
  server(id) {
    const key = String(id);
    if (!this.data[key]) this.data[key] = structuredClone(this.defaults);
    return this.data[key];
  }

  /** The whole settings object of one server, never null. */
  getServer(id) {
    return this.server(id);
  }

  /** Replace the whole settings object of one server. */
  replace(id, value) {
    this.data[String(id)] = value;
    this.save();
    return value;
  }

  get(id, key, fallback = null) {
    const s = this.server(id);
    return s[key] === undefined ? fallback : s[key];
  }

  set(id, key, value) {
    this.server(id)[key] = value;
    this.save();
    return value;
  }

  remove(id, key) {
    delete this.server(id)[key];
    this.save();
  }

  save() {
    this._dirty = true;
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush();
    }, 800);
    this._timer.unref?.();
  }

  flush() {
    if (!this._dirty) return;
    this._dirty = false;
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(`${this.file}.tmp`, JSON.stringify(this.data, null, 2));
      renameSync(`${this.file}.tmp`, this.file);
    } catch (e) {
      console.error(`[lucre] could not save ${this.file}:`, e.message);
    }
  }
}

export const stores = new Map();
export const store = (name, defaults = {}) => {
  if (!stores.has(name)) stores.set(name, new JsonStore(name, defaults));
  return stores.get(name);
};
export const flushAll = () => {
  for (const s of stores.values()) s.flush();
};
