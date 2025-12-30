/**
 * @file Embeddingサービスのユニットテスト
 * @description モックEmbeddingの動作確認
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createEmbedding,
  EMBEDDING_DIMENSION,
} from "../../../src/services/embedding";

describe("createEmbedding (モックモード)", () => {
  beforeEach(() => {
    // モックモードを有効化
    vi.stubEnv("USE_MOCK_EMBEDDING", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("1536次元のベクトルを返す", async () => {
    const embedding = await createEmbedding("テストテキスト");

    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(embedding).toHaveLength(1536);
  });

  it("すべての要素がnumber型", async () => {
    const embedding = await createEmbedding("テスト");

    embedding.forEach((val) => {
      expect(typeof val).toBe("number");
      expect(Number.isNaN(val)).toBe(false);
      expect(Number.isFinite(val)).toBe(true);
    });
  });

  it("同じテキストから同じベクトルが生成される（決定的）", async () => {
    const text = "同一テキスト";
    const embedding1 = await createEmbedding(text);
    const embedding2 = await createEmbedding(text);

    expect(embedding1).toEqual(embedding2);
  });

  it("異なるテキストから異なるベクトルが生成される", async () => {
    const embedding1 = await createEmbedding("テキストA");
    const embedding2 = await createEmbedding("テキストB");

    expect(embedding1).not.toEqual(embedding2);
  });

  it("ベクトルが正規化されている（L2ノルム≈1）", async () => {
    const embedding = await createEmbedding("正規化テスト");

    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));

    // 浮動小数点誤差を考慮
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it("空文字でもベクトルを返す", async () => {
    const embedding = await createEmbedding("");

    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
  });

  it("非常に長いテキストでもベクトルを返す", async () => {
    const longText = "あ".repeat(10000);
    const embedding = await createEmbedding(longText);

    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
  });

  it("日本語テキストを正しく処理する", async () => {
    const embedding = await createEmbedding("日本語のテキストです。絵文字も🎉");

    expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
  });
});
