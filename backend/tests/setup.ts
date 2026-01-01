/**
 * @file テストセットアップ
 * @description vitestの各テスト実行前に読み込まれる共通設定
 */

import { beforeAll, afterAll } from "vitest";

// テスト環境であることを明示
process.env.NODE_ENV = "test";

// モックEmbeddingを有効化（OpenAI APIを呼ばない）
process.env.USE_MOCK_EMBEDDING = "true";

beforeAll(() => {
  // テスト開始前の共通処理
});

afterAll(() => {
  // テスト終了後の共通処理
});
