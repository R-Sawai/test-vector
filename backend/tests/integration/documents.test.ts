/**
 * @file ドキュメントAPIの統合テスト
 * @description POST/GET/DELETE /api/documents のテスト
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

describe("Documents API", () => {
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

  describe("POST /api/documents", () => {
    describe("バリデーション", () => {
      it("contentなしで400エラー", async () => {
        const response = await request(app).post("/api/documents").send({});

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          error: "Validation failed",
        });
      });

      it("content空文字で400エラー", async () => {
        const response = await request(app)
          .post("/api/documents")
          .send({ content: "" });

        expect(response.status).toBe(400);
        expect(response.body.details).toHaveProperty("content");
      });

      it("content 10001文字で400エラー", async () => {
        const response = await request(app)
          .post("/api/documents")
          .send({ content: "A".repeat(10001) });

        expect(response.status).toBe(400);
        expect(response.body.details.content[0]).toContain("10000文字以内");
      });
    });

    describe("正常系（DB必要）", () => {
      it("正常なリクエストで201を返す", async () => {
        if (skipIfNoDb()) return;

        const response = await request(app)
          .post("/api/documents")
          .send({ content: "テストドキュメント" });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          id: expect.any(Number),
          content: "テストドキュメント",
          metadata: {},
        });
      });

      it("metadata付きで201を返す", async () => {
        if (skipIfNoDb()) return;

        const response = await request(app)
          .post("/api/documents")
          .send({
            content: "メタデータ付きドキュメント",
            metadata: { category: "test", priority: 1 },
          });

        expect(response.status).toBe(201);
        expect(response.body.metadata).toEqual({
          category: "test",
          priority: 1,
        });
      });

      it("createdAtとupdatedAtが返される", async () => {
        if (skipIfNoDb()) return;

        const response = await request(app)
          .post("/api/documents")
          .send({ content: "日時確認用" });

        expect(response.status).toBe(201);
        expect(response.body.createdAt).toBeDefined();
        expect(response.body.updatedAt).toBeDefined();
      });
    });
  });

  describe("GET /api/documents", () => {
    it("ドキュメント0件で空配列を返す", async () => {
      if (skipIfNoDb()) return;

      const response = await request(app).get("/api/documents");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("複数件を作成日時降順で返す", async () => {
      if (skipIfNoDb()) return;

      // テスト専用に新規作成（既存データがあっても対応）
      await request(app)
        .post("/api/documents")
        .send({ content: "Doc A for order test" });
      await request(app)
        .post("/api/documents")
        .send({ content: "Doc B for order test" });
      await request(app)
        .post("/api/documents")
        .send({ content: "Doc C for order test" });

      const response = await request(app).get("/api/documents");

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
      // 降順確認（最新が先頭）
      const contents = response.body.map((d: any) => d.content);
      expect(contents[0]).toBe("Doc C for order test");
    });
  });

  describe("DELETE /api/documents/:id", () => {
    describe("バリデーション", () => {
      it("非数値IDで400エラー", async () => {
        const response = await request(app).delete("/api/documents/abc");

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          error: "Validation failed",
        });
      });

      it("小数IDで400エラー", async () => {
        const response = await request(app).delete("/api/documents/1.5");

        expect(response.status).toBe(400);
      });
    });

    describe("正常系（DB必要）", () => {
      it("存在するIDで200を返す", async () => {
        if (skipIfNoDb()) return;

        // まず作成
        const createRes = await request(app)
          .post("/api/documents")
          .send({ content: "削除対象" });
        const id = createRes.body.id;

        // 削除
        const deleteRes = await request(app).delete(`/api/documents/${id}`);

        expect(deleteRes.status).toBe(200);
        expect(deleteRes.body).toMatchObject({
          message: "Document deleted successfully",
        });
      });

      it("存在しないIDで404を返す", async () => {
        if (skipIfNoDb()) return;

        const response = await request(app).delete("/api/documents/99999");

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
          error: "Document not found",
        });
      });

      it("削除後にGETで取得できない", async () => {
        if (skipIfNoDb()) return;

        // 作成
        const createRes = await request(app)
          .post("/api/documents")
          .send({ content: "削除確認用" });
        const id = createRes.body.id;

        // 削除
        await request(app).delete(`/api/documents/${id}`);

        // 一覧取得
        const listRes = await request(app).get("/api/documents");
        const found = listRes.body.find((d: any) => d.id === id);

        expect(found).toBeUndefined();
      });
    });
  });
});
