# テスト実装計画

vitest + supertest を使用した自動テスト環境の構築計画です。

## 📋 目次

1. [テスト環境のセットアップ](#1-テスト環境のセットアップ)
2. [テストの種類と方針](#2-テストの種類と方針)
3. [モック戦略](#3-モック戦略)
4. [テストケース一覧](#4-テストケース一覧)
5. [ディレクトリ構成](#5-ディレクトリ構成)
6. [実装順序](#6-実装順序)
7. [CI/CD 連携](#7-cicd連携)

---

## 1. テスト環境のセットアップ

### 1.1 必要なパッケージ

```bash
npm install -D vitest supertest @types/supertest
```

### 1.2 vitest 設定ファイル

`backend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules", "dist", "**/*.test.ts"],
    },
    // テスト用環境変数
    env: {
      NODE_ENV: "test",
      USE_MOCK_EMBEDDING: "true",
    },
  },
});
```

### 1.3 package.json スクリプト追加

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

## 2. テストの種類と方針

| 種類               | 対象                   | DB                | OpenAI API       | 実行速度 |
| ------------------ | ---------------------- | ----------------- | ---------------- | -------- |
| **ユニットテスト** | スキーマ、ヘルパー関数 | 不要              | 不要             | 高速     |
| **統合テスト**     | API エンドポイント     | モックまたは実 DB | モック           | 中速     |
| **E2E テスト**     | 全体フロー             | 実 DB (Docker)    | 実 API or モック | 低速     |

### 方針

1. **ユニットテスト**: 外部依存なしで高速に実行
2. **統合テスト**: DB はテスト用コンテナ or モック、OpenAI API は常にモック
3. **E2E テスト**: CI/CD ではオプション（コスト考慮）

---

## 3. モック戦略

### 3.1 OpenAI Embedding のモック

**目的**: API KEY なしでテスト可能にする、API コスト削減

**方法**: 環境変数 `USE_MOCK_EMBEDDING=true` でダミーベクトルを返す

```typescript
// services/embedding.ts に追加
export async function createEmbedding(text: string): Promise<number[]> {
  // テスト環境ではモックを使用
  if (process.env.USE_MOCK_EMBEDDING === "true") {
    return createMockEmbedding(text);
  }

  // 本番: OpenAI API呼び出し
  // ...
}

/**
 * テスト用のダミー埋め込みベクトルを生成
 * テキストのハッシュから決定的なベクトルを生成（同じテキスト→同じベクトル）
 */
function createMockEmbedding(text: string): number[] {
  const hash = simpleHash(text);
  const vector: number[] = [];
  for (let i = 0; i < 1536; i++) {
    // 決定的な疑似乱数
    vector.push(Math.sin(hash + i) * 0.5);
  }
  // 正規化
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map((v) => v / norm);
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
```

### 3.2 データベースのモック戦略

| 方式                     | メリット                 | デメリット         | 採用           |
| ------------------------ | ------------------------ | ------------------ | -------------- |
| **テスト用 DB コンテナ** | 実際の pgvector で検証可 | 起動に時間がかかる | 統合テスト     |
| **pg-mem（インメモリ）** | 高速                     | pgvector 非対応    | ❌             |
| **モック（vi.mock）**    | 最速                     | 実 DB の挙動と乖離 | ユニットテスト |

**推奨**:

- ユニットテスト → DB モック
- 統合テスト → docker-compose.test.yml で専用 DB コンテナ

---

## 4. テストケース一覧

### 4.1 ユニットテスト

#### Zod スキーマ (`tests/unit/schemas/document.test.ts`)

| テストケース                                | 期待結果                             |
| ------------------------------------------- | ------------------------------------ |
| `createDocumentSchema` - 正常な content     | ✅ パース成功                        |
| `createDocumentSchema` - 空文字 content     | ❌ エラー                            |
| `createDocumentSchema` - 10001 文字 content | ❌ エラー                            |
| `createDocumentSchema` - metadata 付き      | ✅ パース成功                        |
| `searchSchema` - query のみ                 | ✅ limit=5, threshold=0 がデフォルト |
| `searchSchema` - limit=0                    | ❌ エラー                            |
| `searchSchema` - limit=101                  | ❌ エラー                            |
| `searchSchema` - threshold=1.5              | ❌ エラー                            |
| `documentIdSchema` - 数値文字列 "123"       | ✅ number 123 に変換                 |
| `documentIdSchema` - 非数値 "abc"           | ❌ エラー                            |

#### ヘルパー関数

| テストケース                            | 対象        |
| --------------------------------------- | ----------- |
| `toPgVectorLiteral` - 配列 → 文字列変換 | vector.ts   |
| `formatZodError` - エラー整形           | validate.ts |

### 4.2 統合テスト（API エンドポイント）

#### `GET /health` (`tests/integration/health.test.ts`)

| テストケース | 期待結果                      |
| ------------ | ----------------------------- |
| DB 接続正常  | 200, `{ status: "ok" }`       |
| DB 接続失敗  | 503, `{ status: "db_error" }` |

#### `POST /api/documents` (`tests/integration/documents.test.ts`)

| テストケース       | 期待結果                  |
| ------------------ | ------------------------- |
| 正常なリクエスト   | 201, ドキュメント返却     |
| content なし       | 400, バリデーションエラー |
| content 空文字     | 400, バリデーションエラー |
| content 10001 文字 | 400, バリデーションエラー |
| metadata 付き      | 201, metadata 含めて保存  |

#### `GET /api/documents` (`tests/integration/documents.test.ts`)

| テストケース       | 期待結果          |
| ------------------ | ----------------- |
| ドキュメント 0 件  | 200, 空配列       |
| ドキュメント複数件 | 200, 作成日時降順 |

#### `DELETE /api/documents/:id` (`tests/integration/documents.test.ts`)

| テストケース  | 期待結果                  |
| ------------- | ------------------------- |
| 存在する ID   | 200, 成功メッセージ       |
| 存在しない ID | 404, エラー               |
| 非数値 ID     | 400, バリデーションエラー |

#### `POST /api/search` (`tests/integration/search.test.ts`)

| テストケース     | 期待結果                  |
| ---------------- | ------------------------- |
| 正常なリクエスト | 200, 結果配列             |
| query なし       | 400, バリデーションエラー |
| limit 指定       | 200, 指定件数以下         |
| threshold 指定   | 200, 閾値以上のみ         |

---

## 5. ディレクトリ構成

```
backend/
├── src/
│   ├── schemas/
│   │   ├── document.ts
│   ├── middleware/
│   │   └── validate.ts
│   └── services/
│       ├── embedding.ts
│       └── vector.ts
├── tests/
│   ├── setup.ts                   # テストセットアップ
│   ├── helpers/
│   │   └── testApp.ts             # supertest用Expressアプリ
│   ├── unit/
│   │   ├── middleware/
│   │   │   └── validate.test.ts
│   │   ├── schemas/
│   │   │   └── document.test.ts
│   │   └── services/
│   │       ├── embedding.test.ts
│   │       └── vector.test.ts
│   └── integration/
│       ├── health.test.ts
│       ├── documents.test.ts
│       └── search.test.ts
├── vitest.config.ts
└── docker-compose.test.yml        # テスト用DB
```

---

## 6. 実装順序

### Phase 1: 環境構築（優先度: 高） ✅ 完了

1. [x] vitest, supertest インストール
2. [x] vitest.config.ts 作成
3. [x] package.json スクリプト追加
4. [x] tests/setup.ts 作成

### Phase 2: モック実装（優先度: 高） ✅ 完了

5. [x] embedding.ts にモックモード追加
6. [x] tests/helpers/testApp.ts 作成（supertest 用）
7. [x] tests/helpers/testDb.ts 作成（DB接続ヘルパー）

### Phase 3: ユニットテスト（優先度: 中） ✅ 完了

8. [x] tests/unit/schemas/document.test.ts (33件)
9. [x] tests/unit/middleware/validate.test.ts (9件)
10. [x] tests/unit/services/embedding.test.ts (8件)
11. [x] tests/unit/services/vector.test.ts (7件)

### Phase 4: 統合テスト（優先度: 中） ✅ 完了

12. [x] docker-compose.test.yml 作成
13. [x] tests/integration/health.test.ts (2件)
14. [x] tests/integration/documents.test.ts (13件)
15. [x] tests/integration/search.test.ts (11件)

### Phase 5: CI/CD（優先度: 低）

16. [ ] GitHub Actions ワークフロー作成
17. [ ] カバレッジレポート設定

---

## 7. CI/CD 連携

### GitHub Actions 例

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Run tests
        working-directory: backend
        env:
          USE_MOCK_EMBEDDING: "true"
          DB_HOST: localhost
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
```

---

## 📝 補足事項

### テスト実行コマンド

```bash
# 全テスト実行
npm test

# ウォッチモード（開発時）
npm run test:watch

# カバレッジ付き
npm run test:coverage

# 特定ファイルのみ
npm test -- tests/unit/schemas/document.test.ts
```

### 期待されるカバレッジ目標

| 対象         | 目標 |
| ------------ | ---- |
| スキーマ     | 100% |
| ミドルウェア | 90%+ |
| サービス     | 80%+ |
| ルート       | 80%+ |

---

## 次のステップ

この計画に基づいてテスト環境を構築する場合は、Phase 1 から順に実装を進めてください。
