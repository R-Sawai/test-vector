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
