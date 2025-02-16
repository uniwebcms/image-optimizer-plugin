// src/cache.js
import Keyv from "keyv";
import debug from "debug";

const log = debug("uniweb:image-optimizer:cache");

export class Cache {
  #store;
  #ttl;
  #size = 0;

  constructor(ttl) {
    this.#ttl = ttl;
    this.#store = new Keyv({
      ttl,
      // Use in-memory storage by default
      // Could be extended to use Redis, SQLite, etc.
      store: new Map(),
    });

    this.#store.on("error", (err) => log("Cache error:", err));
  }

  async set(key, value) {
    await this.#store.set(key, {
      value,
      timestamp: Date.now(),
    });
    this.#size++;
    log("Cached:", key);
  }

  async get(key) {
    const entry = await this.#store.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (this.#isExpired(entry.timestamp)) {
      await this.delete(key);
      return null;
    }

    log("Cache hit:", key);
    return entry.value;
  }

  async has(key) {
    return (await this.get(key)) !== null;
  }

  async delete(key) {
    const deleted = await this.#store.delete(key);
    if (deleted) {
      this.#size--;
      log("Removed from cache:", key);
    }
    return deleted;
  }

  async clear() {
    await this.#store.clear();
    this.#size = 0;
    log("Cache cleared");
  }

  #isExpired(timestamp) {
    return Date.now() - timestamp > this.#ttl;
  }

  get size() {
    return this.#size;
  }
}
