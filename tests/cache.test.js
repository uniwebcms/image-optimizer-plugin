// tests/cache.test.js
import { jest } from "@jest/globals";
import { Cache } from "../src/cache.js";

describe("Cache", () => {
  let cache;

  beforeEach(() => {
    // Create cache with short TTL for testing
    cache = new Cache(100); // 100ms TTL
  });

  test("stores and retrieves values", async () => {
    const key = "test-key";
    const value = { data: "test-value" };

    await cache.set(key, value);
    const retrieved = await cache.get(key);

    expect(retrieved).toEqual(value);
    expect(cache.size).toBe(1);
  });

  test("handles cache misses", async () => {
    const result = await cache.get("nonexistent");
    expect(result).toBeNull();
  });

  test("respects TTL", async () => {
    const key = "expiring-key";
    await cache.set(key, "value");

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = await cache.get(key);
    expect(result).toBeNull();
    expect(cache.size).toBe(0);
  });

  test("deletes entries", async () => {
    const key = "delete-test";
    await cache.set(key, "value");

    // Verify entry exists
    expect(await cache.has(key)).toBe(true);

    // Delete entry
    await cache.delete(key);

    // Verify entry is gone
    expect(await cache.has(key)).toBe(false);
    expect(cache.size).toBe(0);
  });

  test("clears all entries", async () => {
    // Add multiple entries
    await Promise.all([
      cache.set("key1", "value1"),
      cache.set("key2", "value2"),
      cache.set("key3", "value3"),
    ]);

    expect(cache.size).toBe(3);

    // Clear cache
    await cache.clear();

    expect(cache.size).toBe(0);
    expect(await cache.get("key1")).toBeNull();
  });

  test("handles concurrent operations", async () => {
    // Perform multiple operations concurrently
    await Promise.all([
      cache.set("key1", "value1"),
      cache.get("key1"),
      cache.set("key2", "value2"),
      cache.delete("key1"),
      cache.set("key3", "value3"),
    ]);

    expect(await cache.get("key1")).toBeNull();
    expect(await cache.get("key2")).toBe("value2");
    expect(await cache.get("key3")).toBe("value3");
  });

  test("maintains accurate size count", async () => {
    await cache.set("key1", "value1");
    expect(cache.size).toBe(1);

    await cache.set("key2", "value2");
    expect(cache.size).toBe(2);

    await cache.delete("key1");
    expect(cache.size).toBe(1);

    await cache.clear();
    expect(cache.size).toBe(0);
  });

  test("handles errors gracefully", async () => {
    // Test with invalid values
    await expect(cache.set(null, "value")).rejects.toThrow();

    // Test with undefined values
    await expect(cache.set("key", undefined)).resolves.not.toThrow();
  });
});
