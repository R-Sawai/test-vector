/**
 * @file テスト用Expressアプリケーション
 * @description supertestで使用するExpressアプリを提供します
 */

import express from "express";
import cors from "cors";
import apiRouter from "../../src/routes/api";

/**
 * テスト用のExpressアプリを作成します
 *
 * @description
 * 本番の index.ts と同様の設定ですが、サーバー起動は行いません。
 * supertestがこのappインスタンスを直接使用します。
 */
export function createTestApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // ヘルスチェック（テスト用にDB接続チェックはスキップ可能）
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // APIルート
  app.use("/api", apiRouter);

  return app;
}
