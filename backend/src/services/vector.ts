/**
 * @file ベクトル検索サービス
 * @description ドキュメントのCRUDおよびpgvectorを使用した類似検索機能を提供します
 */

import { pool } from "../config/database";
import { createEmbedding } from "./embedding";
import type {
  CreateDocumentInput,
  Document,
  SearchResult,
  SearchInput,
} from "../models/document";

/**
 * 数値配列をpgvectorのvectorリテラル形式に変換します
 *
 * @param vector - 数値の配列（埋め込みベクトル）
 * @returns pgvectorが受け付ける形式の文字列 例: "[0.1,0.2,...]"
 */
export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * 新しいドキュメントを追加します
 *
 * @description
 * 1. テキストをOpenAI APIでベクトル化
 * 2. ベクトルとメタデータを含めてDBに保存
 *
 * @param input - ドキュメント作成入力（content必須、metadata任意）
 * @returns 作成されたドキュメント
 */
export async function addDocument(
  input: CreateDocumentInput
): Promise<Document> {
  const { content, metadata = {} } = input;

  // テキストをベクトルに変換
  const embedding = await createEmbedding(content);

  const query = `
    INSERT INTO documents (content, embedding, metadata)
    VALUES ($1, $2::vector, $3::jsonb)
    RETURNING id, content, metadata, created_at, updated_at
  `;

  const result = await pool.query(query, [
    content,
    toPgVectorLiteral(embedding),
    metadata,
  ]);
  const row = result.rows[0];

  return {
    id: row.id,
    content: row.content,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * すべてのドキュメントを取得します
 *
 * @returns 作成日時の降順でソートされたドキュメント一覧
 */
export async function getAllDocuments(): Promise<Document[]> {
  const query = `
    SELECT id, content, metadata, created_at, updated_at
    FROM documents
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query);

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * 指定IDのドキュメントを削除します
 *
 * @param id - 削除するドキュメントのID
 * @returns 削除に成功した場合true、ドキュメントが存在しない場合false
 */
export async function deleteDocument(id: number): Promise<boolean> {
  const query = "DELETE FROM documents WHERE id = $1 RETURNING id";
  const result = await pool.query(query, [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 類似ドキュメントを検索します（コサイン類似度）
 *
 * @description
 * 1. 検索クエリをベクトル化
 * 2. pgvectorのコサイン距離演算子（<=>）で類似検索
 * 3. 類似度の閾値でフィルタリング
 *
 * @param input - 検索入力（query必須、limit/thresholdはデフォルトあり）
 * @returns 類似度の高い順にソートされた検索結果
 */
export async function searchSimilar(
  input: SearchInput
): Promise<SearchResult[]> {
  const { query, limit, threshold } = input;

  // 検索クエリをベクトルに変換
  const embedding = await createEmbedding(query);

  // pgvectorの<=>(コサイン距離)は0〜2の値を返す
  // 1 - 距離 で類似度（0〜1）に変換
  const sql = `
    SELECT
      id,
      content,
      metadata,
      created_at,
      1 - (embedding <=> $1::vector) AS similarity
    FROM documents
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> $1::vector) >= $3
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `;

  const result = await pool.query(sql, [
    toPgVectorLiteral(embedding),
    limit,
    threshold,
  ]);

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: Number(row.similarity),
    createdAt: row.created_at,
  }));
}
