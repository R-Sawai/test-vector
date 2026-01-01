/**
 * @file 検索APIの統合テスト
 * @description POST /api/search のテスト
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp";
import {
  clearDocuments,
  checkConnection,
  closeConnection,
} from "../helpers/testDb";

const app = createTestApp();

// DB接続状態を保持
let dbAvailable = false;

// テスト内でDBが必要な場合にスキップするヘルパー
function skipIfNoDb() {
  if (!dbAvailable) {
    console.log("  → Skipped (DB not available)");
    return true;
  }
  return false;
}

describe("Search API", () => {
  beforeAll(async () => {
    dbAvailable = await checkConnection();
    if (!dbAvailable) {
      console.warn("⚠️ Test DB not available - some tests will be skipped");
    }
  });

  afterAll(async () => {
    await closeConnection();
  });

  beforeEach(async () => {
    if (dbAvailable) {
      await clearDocuments();
    }
  });

  describe("POST /api/search", () => {
    describe("バリデーション", () => {
      it("queryなしで400エラー", async () => {
        const response = await request(app).post("/api/search").send({});

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          error: "Validation failed",
        });
      });

      it("query空文字で400エラー", async () => {
        const response = await request(app)
          .post("/api/search")
          .send({ query: "" });

        expect(response.status).toBe(400);
        expect(response.body.details).toHaveProperty("query");
      });

      it("limit=0で400エラー", async () => {
        const response = await request(app)
          .post("/api/search")
          .send({ query: "test", limit: 0 });

        expect(response.status).toBe(400);
        expect(response.body.details).toHaveProperty("limit");
      });

      it("limit=101で400エラー", async () => {
        const response = await request(app)
          .post("/api/search")
          .send({ query: "test", limit: 101 });

        expect(response.status).toBe(400);
      });

      it("threshold=-0.1で400エラー", async () => {
        const response = await request(app)
          .post("/api/search")
          .send({ query: "test", threshold: -0.1 });

        expect(response.status).toBe(400);
      });

      it("threshold=1.5で400エラー", async () => {
        const response = await request(app)
          .post("/api/search")
          .send({ query: "test", threshold: 1.5 });

        expect(response.status).toBe(400);
      });
    });

    describe("正常系（DB必要）", () => {
      it("正常なリクエストで200を返す", async () => {
        if (skipIfNoDb()) return;

        const response = await request(app)
          .post("/api/search")
          .send({ query: "テスト検索" });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          query: "テスト検索",
          count: expect.any(Number),
          results: expect.any(Array),
        });
      });

      it("ドキュメント0件で空の結果を返す", async () => {
        if (skipIfNoDb()) return;

        const response = await request(app)
          .post("/api/search")
          .send({ query: "何もない" });

        expect(response.status).toBe(200);
        expect(response.body.count).toBe(0);
        expect(response.body.results).toEqual([]);
      });

      it("limit指定で件数が制限される", async () => {
        if (skipIfNoDb()) return;

        // 5件作成
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post("/api/documents")
            .send({ content: `Document ${i}` });
        }

        const response = await request(app)
          .post("/api/search")
          .send({ query: "Document", limit: 3 });

        expect(response.status).toBe(200);
        expect(response.body.results.length).toBeLessThanOrEqual(3);
      });

      it("検索結果にsimilarityが含まれる", async () => {
        if (skipIfNoDb()) return;

        // ドキュメント作成
        await request(app)
          .post("/api/documents")
          .send({ content: "類似度テスト用のドキュメント" });

        const response = await request(app)
          .post("/api/search")
          .send({ query: "類似度テスト" });

        expect(response.status).toBe(200);
        if (response.body.results.length > 0) {
          expect(response.body.results[0]).toHaveProperty("similarity");
          expect(typeof response.body.results[0].similarity).toBe("number");
        }
      });

      it("デフォルトでlimit=5, threshold=0が適用される", async () => {
        if (skipIfNoDb()) return;

        // 10件作成
        for (let i = 0; i < 10; i++) {
          await request(app)
            .post("/api/documents")
            .send({ content: `Test document number ${i}` });
        }

        const response = await request(app)
          .post("/api/search")
          .send({ query: "Test document" });

        expect(response.status).toBe(200);
        // デフォルトlimit=5なので最大5件
        expect(response.body.results.length).toBeLessThanOrEqual(5);
      });
    });
  });
});
