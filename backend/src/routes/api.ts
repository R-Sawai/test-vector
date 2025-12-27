/**
 * @file APIルート定義
 * @description ドキュメントのCRUDおよび類似検索のREST APIエンドポイントを定義します
 */

import { Router, Request, Response } from "express";
import {
  addDocument,
  getAllDocuments,
  deleteDocument,
  searchSimilar,
} from "../services/vector";
import { validateBody, validateParams } from "../middleware/validate";
import {
  createDocumentSchema,
  searchSchema,
  documentIdSchema,
} from "../schemas/document";

const router = Router();

/**
 * POST /api/documents
 * 新しいドキュメントを作成します
 *
 * @body {string} content - ドキュメントのテキスト内容（1〜10,000文字）
 * @body {object} [metadata] - 任意のメタデータ
 * @returns {201} 作成されたドキュメント
 * @returns {400} バリデーションエラー
 * @returns {500} サーバーエラー
 */
router.post(
  "/documents",
  validateBody(createDocumentSchema),
  async (req: Request, res: Response) => {
    try {
      const { content, metadata } = req.body;
      const document = await addDocument({ content, metadata });
      res.status(201).json(document);
    } catch (error) {
      console.error("Error adding document:", error);
      res.status(500).json({ error: "Failed to add document" });
    }
  }
);

/**
 * GET /api/documents
 * すべてのドキュメントを取得します
 *
 * @returns {200} ドキュメントの配列（作成日時の降順）
 * @returns {500} サーバーエラー
 */
router.get("/documents", async (_req: Request, res: Response) => {
  try {
    const documents = await getAllDocuments();
    res.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

/**
 * DELETE /api/documents/:id
 * 指定IDのドキュメントを削除します
 *
 * @param {number} id - 削除するドキュメントのID
 * @returns {200} 削除成功メッセージ
 * @returns {400} バリデーションエラー（IDが数値でない）
 * @returns {404} ドキュメントが見つからない
 * @returns {500} サーバーエラー
 */
router.delete(
  "/documents/:id",
  validateParams(documentIdSchema),
  async (req: Request, res: Response) => {
    try {
      // validateParamsによりidはnumberに変換済み
      const { id } = req.params as unknown as { id: number };
      const deleted = await deleteDocument(id);

      if (deleted) {
        res.json({ message: "Document deleted successfully" });
      } else {
        res.status(404).json({ error: "Document not found" });
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  }
);

/**
 * POST /api/search
 * 類似ドキュメントを検索します
 *
 * @body {string} query - 検索クエリテキスト
 * @body {number} [limit=5] - 取得件数上限（1〜100）
 * @body {number} [threshold=0] - 類似度の下限閾値（0〜1）
 * @returns {200} 検索結果（query, count, results）
 * @returns {400} バリデーションエラー
 * @returns {500} サーバーエラー
 */
router.post(
  "/search",
  validateBody(searchSchema),
  async (req: Request, res: Response) => {
    try {
      // validateBodyによりデフォルト値が適用済み
      const { query, limit, threshold } = req.body;
      const results = await searchSimilar({ query, limit, threshold });
      res.json({ query, count: results.length, results });
    } catch (error) {
      console.error("Error searching documents:", error);
      res.status(500).json({ error: "Failed to search documents" });
    }
  }
);

export default router;
