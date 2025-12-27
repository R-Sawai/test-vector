/**
 * @file Zodバリデーションミドルウェア
 * @description ExpressのリクエストをZodスキーマで検証するミドルウェアを提供します
 */

import type { Request, Response, NextFunction } from "express";
import type { ZodError, ZodType } from "zod";

/**
 * リクエストボディをZodスキーマで検証するミドルウェアを生成します
 *
 * @template Output - スキーマの出力型（transformを含む場合は変換後の型）
 * @param schema - 検証に使用するZodスキーマ
 * @returns Expressミドルウェア関数
 *
 * @example
 * router.post('/documents', validateBody(createDocumentSchema), handler);
 */
export function validateBody<Output>(schema: ZodType<Output, any, any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // バリデーション失敗時は400エラーを返す
      return res.status(400).json({
        error: "Validation failed",
        details: formatZodError(result.error),
      });
    }

    // 検証済みデータで上書き（デフォルト値やtransformが適用される）
    req.body = result.data;
    next();
  };
}

/**
 * URLパラメータをZodスキーマで検証するミドルウェアを生成します
 *
 * @template Output - スキーマの出力型
 * @param schema - 検証に使用するZodスキーマ
 * @returns Expressミドルウェア関数
 *
 * @example
 * router.delete('/documents/:id', validateParams(documentIdSchema), handler);
 */
export function validateParams<Output>(schema: ZodType<Output, any, any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: formatZodError(result.error),
      });
    }

    // 検証・変換済みデータで上書き
    req.params = result.data as any;
    next();
  };
}

/**
 * ZodErrorを読みやすい形式に変換します
 *
 * @param error - Zodのバリデーションエラー
 * @returns フィールド名をキー、エラーメッセージ配列を値とするオブジェクト
 *
 * @example
 * // 戻り値の例:
 * // { "content": ["content は1文字以上必要です"], "limit": ["limit は整数である必要があります"] }
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    // パスが空の場合は "_root" をキーとする
    const path = issue.path.join(".") || "_root";
    formatted[path] ??= [];
    formatted[path].push(issue.message);
  }

  return formatted;
}
