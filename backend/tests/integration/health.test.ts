/**
 * @file ヘルスチェックエンドポイントの統合テスト
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp";
import { checkConnection, closeConnection } from "../helpers/testDb";

const app = createTestApp();

describe("GET /health", () => {
  beforeAll(async () => {
    // DB接続確認（接続できなくてもテストは続行）
    const connected = await checkConnection();
    if (!connected) {
      console.warn("⚠️ Test DB not available - some tests may fail");
    }
  });

  afterAll(async () => {
    await closeConnection();
  });

  it("200とstatus: okを返す", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
    });
  });

  it("timestampが含まれる", async () => {
    const response = await request(app).get("/health");

    expect(response.body.timestamp).toBeDefined();
    expect(typeof response.body.timestamp).toBe("string");
  });
});
