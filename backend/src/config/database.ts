/**
 * @file PostgreSQLデータベース接続設定
 * @description pgvectorを使用するPostgreSQLへの接続プールを提供します
 */

import { Pool } from "pg";
import dotenv from "dotenv";

// 環境変数を読み込み
dotenv.config();

/**
 * PostgreSQL接続プール
 *
 * @description
 * 接続プールを使用することで、リクエストごとに新しい接続を作成する
 * オーバーヘッドを削減し、効率的にデータベース接続を再利用します。
 *
 * 設定値:
 * - max: 最大接続数（20）
 * - idleTimeoutMillis: アイドル接続のタイムアウト（30秒）
 * - connectionTimeoutMillis: 接続タイムアウト（2秒）
 */
export const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? "vectoruser",
  password: process.env.POSTGRES_PASSWORD ?? "vectorpass",
  database: process.env.POSTGRES_DB ?? "vectordb",
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

/**
 * データベース接続をテストします
 *
 * @throws {Error} 接続に失敗した場合
 *
 * @example
 * try {
 *   await testConnection();
 *   console.log('DB接続成功');
 * } catch (err) {
 *   console.error('DB接続失敗:', err);
 * }
 */
export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    // 必ずクライアントを解放してプールに戻す
    client.release();
  }
}
