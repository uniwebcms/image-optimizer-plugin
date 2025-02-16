// tests/setup.js
import { jest } from "@jest/globals";

// Suppress debug output during tests
jest.mock("debug", () => () => jest.fn());

// Mock filesystem for consistent testing
const mockFiles = new Map();

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn((path) => {
    if (mockFiles.has(path)) {
      return Promise.resolve(mockFiles.get(path));
    }
    return Promise.reject(new Error(`ENOENT: ${path}`));
  }),
  writeFile: jest.fn((path, content) => {
    mockFiles.set(path, content);
    return Promise.resolve();
  }),
  mkdir: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({
    isDirectory: () => true,
    isFile: () => true,
  }),
}));

// Reset mocks between tests
beforeEach(() => {
  mockFiles.clear();
});
