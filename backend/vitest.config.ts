import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // 統合テストでDB競合を避けるためシーケンシャル実行
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules", "dist", "**/*.test.ts"],
    },
    env: {
      NODE_ENV: "test",
      USE_MOCK_EMBEDDING: "true",
      // テスト用DB接続設定
      DB_HOST: "localhost",
      DB_PORT: "5433",
      POSTGRES_USER: "testuser",
      POSTGRES_PASSWORD: "testpass",
      POSTGRES_DB: "testdb",
    },
  },
});
