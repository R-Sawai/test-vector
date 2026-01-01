/**
 * @file バリデーションミドルウェアのユニットテスト
 * @description validateBody, validateParamsの検証
 */

import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateBody, validateParams } from "../../../src/middleware/validate";

// モックのRequest, Response, NextFunctionを作成するヘルパー
function createMockReq(
  options: { body?: unknown; params?: unknown } = {}
): Partial<Request> {
  return {
    body: options.body ?? {},
    params: (options.params ?? {}) as any,
  };
}

function createMockRes(): Partial<Response> & {
  jsonData?: unknown;
  statusCode?: number;
} {
  const res: Partial<Response> & { jsonData?: unknown; statusCode?: number } = {
    statusCode: 200,
    jsonData: undefined,
  };

  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  });

  res.json = vi.fn((data: unknown) => {
    res.jsonData = data;
    return res as Response;
  });

  return res;
}

describe("validateBody", () => {
  const testSchema = z.object({
    name: z.string().min(1, "name is required"),
    age: z.number().int().min(0).optional(),
  });

  describe("正常系", () => {
    it("有効なボディでnextが呼ばれる", () => {
      const req = createMockReq({ body: { name: "John" } });
      const res = createMockRes();
      const next = vi.fn();

      const middleware = validateBody(testSchema);
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("検証済みデータでreq.bodyが上書きされる", () => {
      const req = createMockReq({ body: { name: "John", extra: "ignored" } });
      const res = createMockRes();
      const next = vi.fn();

      const middleware = validateBody(testSchema);
      middleware(req as Request, res as Response, next);

      // extraは除外される（スキーマに定義されていない）
      expect(req.body).toEqual({ name: "John" });
    });

    it("デフォルト値が適用される", () => {
      const schemaWithDefault = z.object({
        value: z.number().default(42),
      });

      const req = createMockReq({ body: {} });
      const res = createMockRes();
      const next = vi.fn();

      const middleware = validateBody(schemaWithDefault);
      middleware(req as Request, res as Response, next);

      expect(req.body).toEqual({ value: 42 });
    });
  });

  describe("異常系", () => {
    it("無効なボディで400エラーを返す", () => {
      const req = createMockReq({ body: {} }); // nameが必須
      const res = createMockRes();
      const next = vi.fn();

      const middleware = validateBody(testSchema);
      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.jsonData).toMatchObject({
        error: "Validation failed",
        details: expect.any(Object),
      });
    });

    it("エラー詳細にフィールド名とメッセージが含まれる", () => {
      const req = createMockReq({ body: { name: "" } }); // 空文字はエラー
      const res = createMockRes();
      const next = vi.fn();

      const middleware = validateBody(testSchema);
      middleware(req as Request, res as Response, next);

      expect(res.jsonData).toMatchObject({
        details: {
          name: expect.arrayContaining(["name is required"]),
        },
      });
    });

    it("複数のエラーがあっても正しく返される", () => {
      const strictSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const req = createMockReq({ body: { name: "", email: "invalid" } });
      const res = createMockRes();
      const next = vi.fn();

      const middleware = validateBody(strictSchema);
      middleware(req as Request, res as Response, next);

      expect(res.jsonData).toMatchObject({
        details: {
          name: expect.any(Array),
          email: expect.any(Array),
        },
      });
    });
  });
});

describe("validateParams", () => {
  const idSchema = z.object({
    id: z
      .string()
      .regex(/^\d+$/)
      .transform((v) => parseInt(v, 10)),
  });

  describe("正常系", () => {
    it("有効なパラメータでnextが呼ばれる", () => {
      const req = createMockReq({ params: { id: "123" } });
      const res = createMockRes();
      const next = vi.fn();

      const middleware = validateParams(idSchema);
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it("transformが適用されてreq.paramsが更新される", () => {
      const req = createMockReq({ params: { id: "456" } });
      const res = createMockRes();
      const next = vi.fn();

      const middleware = validateParams(idSchema);
      middleware(req as Request, res as Response, next);

      expect(req.params).toEqual({ id: 456 }); // numberに変換済み
    });
  });

  describe("異常系", () => {
    it("無効なパラメータで400エラーを返す", () => {
      const req = createMockReq({ params: { id: "abc" } });
      const res = createMockRes();
      const next = vi.fn();

      const middleware = validateParams(idSchema);
      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.jsonData).toMatchObject({
        error: "Validation failed",
      });
    });
  });
});
