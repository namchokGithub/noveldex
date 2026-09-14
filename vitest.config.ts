import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
    },
  },
});
