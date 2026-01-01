/**
 * @file OpenAI Embeddingサービス
 * @description テキストをベクトル（埋め込み）に変換するサービスを提供します
 */

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

/** 使用するOpenAI Embeddingモデル */
export const EMBEDDING_MODEL = "text-embedding-3-small" as const;

/** Embeddingベクトルの次元数（text-embedding-3-smallは1536次元） */
export const EMBEDDING_DIMENSION = 1536 as const;

/**
 * OpenAIクライアントを取得します
 *
 * @returns OpenAIクライアントインスタンス
 * @throws {Error} OPENAI_API_KEYが設定されていない場合
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return new OpenAI({ apiKey });
}

/**
 * テキストをベクトル（埋め込み）に変換します
 *
 * @param text - ベクトル化するテキスト
 * @returns 1536次元の埋め込みベクトル（number配列）
 * @throws {Error} APIキー未設定、API呼び出し失敗、次元数不一致の場合
 *
 * @example
 * const embedding = await createEmbedding('こんにちは');
 * console.log(embedding.length); // 1536
 */
export async function createEmbedding(text: string): Promise<number[]> {
  // テスト環境ではモックを使用（OpenAI API呼び出しをスキップ）
  if (process.env.USE_MOCK_EMBEDDING === "true") {
    return createMockEmbedding(text);
  }

  const openai = getOpenAIClient();

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Embedding response was empty");
  }

  // 次元数の整合性チェック（DBスキーマと一致している必要がある）
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Unexpected embedding dimension: ${embedding.length} (expected ${EMBEDDING_DIMENSION})`
    );
  }

  return embedding;
}

/**
 * テスト用のダミー埋め込みベクトルを生成します
 *
 * @description
 * テキストのハッシュから決定的なベクトルを生成します。
 * 同じテキストからは常に同じベクトルが生成されます。
 *
 * @param text - ベクトル化するテキスト
 * @returns 1536次元の正規化されたベクトル
 */
function createMockEmbedding(text: string): number[] {
  const hash = simpleHash(text);
  const vector: number[] = [];

  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    // 決定的な疑似乱数（sin関数で分散）
    vector.push(Math.sin(hash + i) * 0.5);
  }

  // L2正規化（単位ベクトル化）
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map((v) => v / norm);
}

/**
 * 文字列から簡易ハッシュ値を計算します
 *
 * @param str - ハッシュ化する文字列
 * @returns 32bit整数のハッシュ値
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // 32bit整数に変換
  }
  return hash;
}
