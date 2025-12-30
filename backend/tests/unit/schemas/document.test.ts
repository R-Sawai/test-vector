/**
 * @file Zodスキーマのユニットテスト
 * @description createDocumentSchema, searchSchema, documentIdSchemaの検証
 */

import { describe, it, expect } from "vitest";
import {
  createDocumentSchema,
  searchSchema,
  documentIdSchema,
} from "../../../src/schemas/document";

describe("createDocumentSchema", () => {
  describe("正常系", () => {
    it("正常なcontentでパース成功", () => {
      const input = { content: "Hello, World!" };
      const result = createDocumentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("Hello, World!");
      }
    });

    it("1文字のcontentでパース成功", () => {
      const input = { content: "A" };
      const result = createDocumentSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("10000文字のcontentでパース成功", () => {
      const input = { content: "A".repeat(10_000) };
      const result = createDocumentSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("metadata付きでパース成功", () => {
      const input = {
        content: "Test content",
        metadata: { category: "test", tags: ["a", "b"] },
      };
      const result = createDocumentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toEqual({
          category: "test",
          tags: ["a", "b"],
        });
      }
    });

    it("metadataなしでもパース成功（optional）", () => {
      const input = { content: "Test" };
      const result = createDocumentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toBeUndefined();
      }
    });
  });

  describe("異常系", () => {
    it("contentなしでエラー", () => {
      const input = {};
      const result = createDocumentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("空文字contentでエラー", () => {
      const input = { content: "" };
      const result = createDocumentSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("1文字以上");
      }
    });

    it("10001文字contentでエラー", () => {
      const input = { content: "A".repeat(10_001) };
      const result = createDocumentSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("10000文字以内");
      }
    });

    it("contentが数値でエラー", () => {
      const input = { content: 123 };
      const result = createDocumentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

describe("searchSchema", () => {
  describe("正常系", () => {
    it("queryのみでパース成功（デフォルト値適用）", () => {
      const input = { query: "検索テキスト" };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe("検索テキスト");
        expect(result.data.limit).toBe(5); // デフォルト
        expect(result.data.threshold).toBe(0); // デフォルト
      }
    });

    it("limit指定でパース成功", () => {
      const input = { query: "test", limit: 10 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it("threshold指定でパース成功", () => {
      const input = { query: "test", threshold: 0.8 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.threshold).toBe(0.8);
      }
    });

    it("limit=1（最小値）でパース成功", () => {
      const input = { query: "test", limit: 1 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("limit=100（最大値）でパース成功", () => {
      const input = { query: "test", limit: 100 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("threshold=0（最小値）でパース成功", () => {
      const input = { query: "test", threshold: 0 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("threshold=1（最大値）でパース成功", () => {
      const input = { query: "test", threshold: 1 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("queryなしでエラー", () => {
      const input = {};
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("query空文字でエラー", () => {
      const input = { query: "" };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("1文字以上");
      }
    });

    it("limit=0でエラー", () => {
      const input = { query: "test", limit: 0 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("1以上");
      }
    });

    it("limit=101でエラー", () => {
      const input = { query: "test", limit: 101 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("100以下");
      }
    });

    it("limit=-1でエラー", () => {
      const input = { query: "test", limit: -1 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("limitが小数でエラー", () => {
      const input = { query: "test", limit: 5.5 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("整数");
      }
    });

    it("threshold=-0.1でエラー", () => {
      const input = { query: "test", threshold: -0.1 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("0以上");
      }
    });

    it("threshold=1.5でエラー", () => {
      const input = { query: "test", threshold: 1.5 };
      const result = searchSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("1以下");
      }
    });
  });
});

describe("documentIdSchema", () => {
  describe("正常系", () => {
    it("数値文字列'123'をnumber 123に変換", () => {
      const input = { id: "123" };
      const result = documentIdSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(123);
        expect(typeof result.data.id).toBe("number");
      }
    });

    it("'0'をnumber 0に変換", () => {
      const input = { id: "0" };
      const result = documentIdSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(0);
      }
    });

    it("大きな数値文字列も変換可能", () => {
      const input = { id: "999999999" };
      const result = documentIdSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(999999999);
      }
    });
  });

  describe("異常系", () => {
    it("非数値'abc'でエラー", () => {
      const input = { id: "abc" };
      const result = documentIdSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("数値");
      }
    });

    it("空文字でエラー", () => {
      const input = { id: "" };
      const result = documentIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("小数'1.5'でエラー", () => {
      const input = { id: "1.5" };
      const result = documentIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("負の数'-1'でエラー", () => {
      const input = { id: "-1" };
      const result = documentIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("数字とアルファベット混合'123abc'でエラー", () => {
      const input = { id: "123abc" };
      const result = documentIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("スペース入り' 123 'でエラー", () => {
      const input = { id: " 123 " };
      const result = documentIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});
