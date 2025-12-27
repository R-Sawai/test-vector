/**
 * @file ドキュメント関連の型定義
 * @description ベクトルDBに保存するドキュメントおよび検索結果の型を定義します
 */

import type { CreateDocumentInput, SearchInput } from "../schemas/document";

/**
 * データベースに保存されたドキュメントを表すインターフェース
 */
export interface Document {
  /** ドキュメントの一意識別子 */
  id: number;
  /** ドキュメントのテキスト内容 */
  content: string;
  /** 任意のメタデータ（タグ、カテゴリなど） */
  metadata: Record<string, unknown>;
  /** 作成日時 */
  createdAt: Date;
  /** 更新日時 */
  updatedAt: Date;
}

/**
 * 類似検索の結果を表すインターフェース
 */
export interface SearchResult {
  /** ドキュメントの一意識別子 */
  id: number;
  /** ドキュメントのテキスト内容 */
  content: string;
  /** 任意のメタデータ */
  metadata: Record<string, unknown>;
  /** コサイン類似度（0〜1、1に近いほど類似） */
  similarity: number;
  /** 作成日時 */
  createdAt: Date;
}

// スキーマから推論された入力型を再エクスポート
export type { CreateDocumentInput, SearchInput };
