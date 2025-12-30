# テスト環境ガイド

vitest + supertest を使用した自動テスト環境のガイドです。

## 🚀 クイックスタート

### テスト用 DB の起動

```bash
# プロジェクトルートで実行
docker compose -f docker-compose.test.yml up -d
```

### テストの実行

```bash
cd backend

# 全テスト実行
npm test

# ユニットテストのみ
npm test -- tests/unit

# 統合テストのみ
npm test -- tests/integration

# ウォッチモード（開発時）
npm run test:watch

# カバレッジ付き
npm run test:coverage
```

### テスト用 DB の停止

```bash
docker compose -f docker-compose.test.yml down
```

---

## 📁 テストファイル構成

```
backend/
├── vitest.config.ts              # vitest設定
├── tests/
│   ├── setup.ts                  # テストセットアップ
│   ├── helpers/
│   │   ├── testApp.ts            # supertest用Expressアプリ
│   │   └── testDb.ts             # DB接続・クリーンアップヘルパー
│   ├── unit/                     # ユニットテスト（57件）
│   │   ├── middleware/
│   │   │   └── validate.test.ts  # バリデーションミドルウェア
│   │   ├── schemas/
│   │   │   └── document.test.ts  # Zodスキーマ
│   │   └── services/
│   │       ├── embedding.test.ts # Embeddingモック
│   │       └── vector.test.ts    # toPgVectorLiteral
│   └── integration/              # 統合テスト（26件）
│       ├── health.test.ts        # ヘルスチェックAPI
│       ├── documents.test.ts     # ドキュメントCRUD API
│       └── search.test.ts        # 類似検索API
```

---

## 🧪 テストの種類

| 種類               | 対象                   | DB          | OpenAI API | 実行速度 |
| ------------------ | ---------------------- | ----------- | ---------- | -------- |
| **ユニットテスト** | スキーマ、ヘルパー関数 | 不要        | モック     | 高速     |
| **統合テスト**     | API エンドポイント     | テスト用 DB | モック     | 中速     |

---

## 🔧 設定

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false, // DB競合を避けるため
    env: {
      NODE_ENV: "test",
      USE_MOCK_EMBEDDING: "true",
      DB_HOST: "localhost",
      DB_PORT: "5433",
      POSTGRES_USER: "testuser",
      POSTGRES_PASSWORD: "testpass",
      POSTGRES_DB: "testdb",
    },
  },
});
```

### docker-compose.test.yml

テスト専用の DB コンテナを起動します。本番環境（ポート 5432）と競合しないようポート 5433 を使用。

```yaml
services:
  test-db:
    build:
      context: ./db
      dockerfile: Dockerfile
    ports:
      - "5433:5432"
    environment:
      - POSTGRES_USER=testuser
      - POSTGRES_PASSWORD=testpass
      - POSTGRES_DB=testdb
    tmpfs:
      - /var/lib/postgresql/data # メモリ上で高速化
```

---

## 🎭 モック戦略

### OpenAI Embedding のモック

環境変数 `USE_MOCK_EMBEDDING=true` でダミーベクトルを返します。

- API キー不要でテスト可能
- API コスト削減
- 決定的なベクトル生成（同じテキスト → 同じベクトル）

```typescript
// vitest.config.ts で自動設定
env: {
  USE_MOCK_EMBEDDING: "true",
}
```

---

## 📊 テストケース一覧

### ユニットテスト

#### Zod スキーマ (`document.test.ts`) - 33 件

| テストケース                    | 期待結果                |
| ------------------------------- | ----------------------- |
| `createDocumentSchema` - 正常   | ✅ パース成功           |
| `createDocumentSchema` - 空文字 | ❌ エラー               |
| `searchSchema` - デフォルト値   | ✅ limit=5, threshold=0 |
| `documentIdSchema` - 変換       | ✅ "123" → 123          |

#### バリデーションミドルウェア (`validate.test.ts`) - 9 件

| テストケース           | 期待結果             |
| ---------------------- | -------------------- |
| 有効なボディ           | ✅ next()が呼ばれる  |
| 無効なボディ           | ❌ 400 エラー        |
| transform が適用される | ✅ req.params が更新 |

#### Embedding (`embedding.test.ts`) - 8 件

| テストケース      | 期待結果                       |
| ----------------- | ------------------------------ |
| 1536 次元ベクトル | ✅ 正しい次元数                |
| 決定的生成        | ✅ 同じテキスト → 同じベクトル |
| 正規化            | ✅ L2 ノルム ≈1                |

#### toPgVectorLiteral (`vector.test.ts`) - 7 件

| テストケース      | 期待結果              |
| ----------------- | --------------------- |
| 数値配列 → 文字列 | ✅ "[0.1,0.2,0.3]"    |
| 1536 次元         | ✅ 正しくフォーマット |

### 統合テスト

#### ヘルスチェック (`health.test.ts`) - 2 件

| テストケース | 期待結果          |
| ------------ | ----------------- |
| DB 接続正常  | 200, status: "ok" |
| timestamp    | ✅ 含まれる       |

#### ドキュメント API (`documents.test.ts`) - 13 件

| テストケース      | 期待結果              |
| ----------------- | --------------------- |
| POST 正常         | 201, ドキュメント返却 |
| POST content 無し | 400, エラー           |
| GET 一覧          | 200, 作成日時降順     |
| DELETE 正常       | 200, 成功メッセージ   |
| DELETE 存在しない | 404, エラー           |

#### 検索 API (`search.test.ts`) - 11 件

| テストケース    | 期待結果        |
| --------------- | --------------- |
| 正常な検索      | 200, 結果配列   |
| query 無し      | 400, エラー     |
| limit 指定      | ✅ 件数制限     |
| similarity 含む | ✅ 類似度スコア |

---

## 📈 カバレッジ目標

| 対象         | 目標 |
| ------------ | ---- |
| スキーマ     | 100% |
| ミドルウェア | 90%+ |
| サービス     | 80%+ |
| ルート       | 80%+ |

---

## 🔄 CI/CD 連携

GitHub Actions での自動テスト例は [test-plan.md](test-plan.md) を参照してください。
