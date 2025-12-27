/**
 * @file アプリケーションエントリーポイント
 * @description Expressサーバーの起動およびミドルウェアの設定を行います
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRouter from "./routes/api";
import { testConnection } from "./config/database";

// 環境変数を読み込み
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// CORSを有効化（全オリジン許可）
app.use(cors());
// JSONボディのパース（最大1MB）
app.use(express.json({ limit: "1mb" }));

/**
 * GET /health
 * ヘルスチェックエンドポイント
 *
 * @description
 * データベース接続を確認し、ステータスを返します。
 * - 200 OK: DB接続正常
 * - 503 Service Unavailable: DB接続失敗
 */
app.get("/health", async (_req, res) => {
  try {
    await testConnection();
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    res
      .status(503)
      .json({ status: "db_error", timestamp: new Date().toISOString() });
  }
});

// APIルートをマウント
app.use("/api", apiRouter);

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
