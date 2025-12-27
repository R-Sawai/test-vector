/**
 * @file Zodバリデーションスキーマ定義
 * @description APIリクエストの入力値を検証するためのスキーマを定義します
 */

import { z } from "zod";

/**
 * ドキュメント作成リクエストのバリデーションスキーマ
 *
 * @property content - 保存するテキスト（1〜10,000文字）
 * @property metadata - 任意のメタデータ（オプション）
 */
export const createDocumentSchema = z.object({
  content: z
    .string({ required_error: "content は必須です" })
    .min(1, "content は1文字以上必要です")
    .max(10_000, "content は10000文字以内にしてください"),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * 類似検索リクエストのバリデーションスキーマ
 *
 * @property query - 検索クエリテキスト
 * @property limit - 取得件数上限（1〜100、デフォルト: 5）
 * @property threshold - 類似度の下限閾値（0〜1、デフォルト: 0）
 */
export const searchSchema = z.object({
  query: z
    .string({ required_error: "query は必須です" })
    .min(1, "query は1文字以上必要です"),
  limit: z
    .number()
    .int("limit は整数である必要があります")
    .min(1, "limit は1以上必要です")
    .max(100, "limit は100以下にしてください")
    .default(5),
  threshold: z
    .number()
    .min(0, "threshold は0以上必要です")
    .max(1, "threshold は1以下にしてください")
    .default(0),
});

/**
 * URLパラメータのドキュメントIDバリデーションスキーマ
 *
 * @description パスパラメータは文字列で届くため、数値に変換（transform）します
 */
export const documentIdSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "ID は数値である必要があります")
    .transform((val) => parseInt(val, 10)),
});

/** ドキュメント作成の入力型（スキーマから自動推論） */
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

/** 類似検索の入力型（スキーマから自動推論） */
export type SearchInput = z.infer<typeof searchSchema>;

/** ドキュメントID入力型（スキーマから自動推論、numberに変換済み） */
export type DocumentIdInput = z.infer<typeof documentIdSchema>;
