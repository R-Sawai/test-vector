/**
 * @file 統合テスト用データベース接続設定
 * @description テスト用DBへの接続とクリーンアップを提供
 */

import { pool } from "../../src/config/database";

// src/config/database.tsのプールを再利用（環境変数で接続先が決まる）
export const testPool = pool;

/**
 * テスト用DBのdocumentsテーブルをクリアします
 */
export async function clearDocuments(): Promise<void> {
  await pool.query("TRUNCATE documents RESTART IDENTITY CASCADE");
}

/**
 * テスト用DBの接続を確認します
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * テスト用DB接続を終了します
 */
export async function closeConnection(): Promise<void> {
  await pool.end();
}
