/**
 * @file ベクトル関連ヘルパー関数のユニットテスト
 * @description toPgVectorLiteralの検証
 */

import { describe, it, expect } from "vitest";
import { toPgVectorLiteral } from "../../../src/services/vector";

describe("toPgVectorLiteral", () => {
  it("数値配列から期待される形式の文字列を生成する", () => {
    const vector = [0.1, 0.2, 0.3];
    const result = toPgVectorLiteral(vector);

    expect(result).toBe("[0.1,0.2,0.3]");
  });

  it("空配列は'[]'になる", () => {
    const vector: number[] = [];
    const result = toPgVectorLiteral(vector);

    expect(result).toBe("[]");
  });

  it("負の数も正しく処理される", () => {
    const vector = [-0.5, 0, 0.5];
    const result = toPgVectorLiteral(vector);

    expect(result).toBe("[-0.5,0,0.5]");
  });

  it("科学的記数法の数値も処理される", () => {
    const vector = [1e-10, 2.5e5];
    const result = toPgVectorLiteral(vector);

    // JavaScriptのtoStringで変換される形式
    expect(result).toBe("[1e-10,250000]");
  });

  it("1536次元のベクトルも正しくフォーマットされる", () => {
    const vector = Array.from({ length: 1536 }, (_, i) => i * 0.001);
    const result = toPgVectorLiteral(vector);

    expect(result.startsWith("[")).toBe(true);
    expect(result.endsWith("]")).toBe(true);
    expect(result.split(",")).toHaveLength(1536);
  });

  it("整数も正しく処理される", () => {
    const vector = [1, 2, 3];
    const result = toPgVectorLiteral(vector);

    expect(result).toBe("[1,2,3]");
  });

  it("単一要素の配列も正しく処理される", () => {
    const vector = [0.5];
    const result = toPgVectorLiteral(vector);

    expect(result).toBe("[0.5]");
  });
});
