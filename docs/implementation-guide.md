# Vector DB Test Application 実装手順書

このドキュメントでは、TypeScript + OpenAI Embedding + pgvector を使用したベクトルデータベースアプリケーションを段階的に実装する手順を説明します。

## 📋 目次

1. [Phase 1: プロジェクト基盤の構築](#phase-1-プロジェクト基盤の構築)
2. [Phase 2: データベース環境の構築](#phase-2-データベース環境の構築)
3. [Phase 3: バックエンドアプリケーションの実装](#phase-3-バックエンドアプリケーションの実装)
4. [Phase 3.5: Zod バリデーションの実装](#phase-35-zod-バリデーションの実装)
5. [Phase 4: OpenAI Embedding サービスの実装](#phase-4-openai-embedding-サービスの実装)
6. [Phase 5: ベクトル検索機能の実装](#phase-5-ベクトル検索機能の実装)
7. [Phase 6: API エンドポイントの実装](#phase-6-api-エンドポイントの実装)
8. [Phase 7: Docker 統合と動作確認](#phase-7-docker-統合と動作確認)

---

## ⚠️ 注意: この手順書と現行実装の差分

この手順書は「段階的に理解しながら実装する」ことを目的に、説明用に簡略化したコードやコマンドを含みます。
リポジトリに追加済みの現行実装（`backend/`, `db/`, `docker-compose.yml`）を動かす場合は、現行実装の内容を正としてください。

主な差分は次のとおりです。

1. **Windows (PowerShell) では一部コマンドがそのまま動きません**

- Phase 1 の `mkdir -p` や `{...}` のブレース展開は Bash 前提です。
- Phase 2 の `docker run -d \` と `$(pwd)` も Bash 前提です。
- Windows では `Set-Location` を使うか、Docker は Phase 7 の `docker-compose.yml` で起動する運用を推奨します。

2. **DB 接続チェックの方針**

- 手順書: 起動時に DB 接続できない場合は `process.exit(1)` で停止する例
- 現行実装: サーバーは起動し、`/health` で DB 疎通を確認して疎通 NG の場合は 503 を返します（運用時に原因切り分けしやすい方針）。

3. **OpenAI Embedding の戻り値・実装スタイル**

- 手順書: `createEmbedding()` が `EmbeddingResult`（usage 等付き）を返す例
- 現行実装: `createEmbedding()` は埋め込みベクトル `number[]` を返し、API キー未設定時は例外を投げます。次元数(1536)もチェックします。
- 手順書にある `createEmbeddings()`（複数一括）は現行実装には未実装です。

4. **ベクトル検索サービスの I/F**

- 手順書: `searchSimilar(queryText, limit, threshold)` 形式の例
- 現行実装: Zod で検証済みの入力を渡す `searchSimilar({ query, limit, threshold })` 形式です。

5. **Zod バリデーション・ミドルウェアの型**

- 手順書: `ZodSchema<T>` を受け取る例
- 現行実装: `transform()`（例: `id` を string→number）を扱えるように `ZodType` を受け取る実装です。

6. **Dockerfile の依存インストール**

- 手順書: `npm install` の例
- 現行実装: 再現性重視で `npm ci` を使用します。

7. **テスト環境**

- 手順書: この手順書にはテスト実装の詳細は含まれていません
- 現行実装: vitest + supertest による自動テスト環境が構築済みです
- 詳細は [testing.md](testing.md) を参照してください

---

## Phase 1: プロジェクト基盤の構築

### 1.1 ディレクトリ構造の作成

```bash
mkdir -p test-vector/backend/src/{config,services,models,routes}
mkdir -p test-vector/db/init
cd test-vector
```

### 1.2 ルートディレクトリのファイル作成

#### `.env.example` の作成

```env
# PostgreSQL
POSTGRES_USER=vectoruser
POSTGRES_PASSWORD=vectorpass
POSTGRES_DB=vectordb

# OpenAI
OPENAI_API_KEY=sk-your-api-key-here
```

#### `.gitignore` の作成

```gitignore
# Environment variables
.env

# Node.js
node_modules/

# Build output
dist/

# Logs
*.log

# IDE
.vscode/
.idea/
```

### 1.3 環境変数の設定

```bash
cp .env.example .env
# .env ファイルを編集して OPENAI_API_KEY を設定
```

### ✅ Phase 1 完了チェックリスト

- [ ] ディレクトリ構造が作成されている
- [ ] `.env.example` が作成されている
- [ ] `.gitignore` が作成されている
- [ ] `.env` ファイルに API キーが設定されている

---

## Phase 2: データベース環境の構築

### 2.1 PostgreSQL + pgvector の Dockerfile 作成

`db/Dockerfile` を作成:

```dockerfile
FROM pgvector/pgvector:pg16

# 必要に応じてカスタム設定を追加
```

### 2.2 データベース初期化スクリプトの作成

`db/init/01_init.sql` を作成:

```sql
-- pgvector 拡張機能を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- ドキュメントテーブルの作成
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),  -- text-embedding-3-small は 1536 次元
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 更新日時を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ベクトル検索用のインデックス（コサイン類似度）
-- データ量が増えたら有効化を推奨
-- CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- HNSWインデックス（より高精度だがメモリ使用量が多い）
-- CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
```

### 2.3 Docker Compose で DB のみ起動してテスト

```bash
# 一時的にDBのみの docker-compose.yml を作成してテスト
docker run -d \
  --name test-pgvector \
  -e POSTGRES_USER=vectoruser \
  -e POSTGRES_PASSWORD=vectorpass \
  -e POSTGRES_DB=vectordb \
  -p 5432:5432 \
  -v $(pwd)/db/init:/docker-entrypoint-initdb.d \
  pgvector/pgvector:pg16

# 接続テスト
docker exec -it test-pgvector psql -U vectoruser -d vectordb -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# テスト後にコンテナを削除
docker stop test-pgvector && docker rm test-pgvector
```

### ✅ Phase 2 完了チェックリスト

- [ ] `db/Dockerfile` が作成されている
- [ ] `db/init/01_init.sql` が作成されている
- [ ] pgvector 拡張が正常に有効化される
- [ ] documents テーブルが作成される

---

## Phase 3: バックエンドアプリケーションの実装

### 3.1 package.json の作成

`backend/package.json` を作成:

```json
{
  "name": "vector-db-backend",
  "version": "1.0.0",
  "description": "Vector DB Test Application Backend",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "openai": "^4.20.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/pg": "^8.10.9",
    "@types/cors": "^2.8.16",
    "typescript": "^5.3.2",
    "ts-node-dev": "^2.0.0"
  }
}
```

### 3.2 tsconfig.json の作成

`backend/tsconfig.json` を作成:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3.3 Backend の Dockerfile 作成

`backend/Dockerfile` を作成:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm install

# ソースコードをコピー
COPY . .

# TypeScript をビルド
RUN npm run build

# ポートを公開
EXPOSE 3000

# アプリケーションを起動
CMD ["npm", "start"]
```

### 3.4 データベース接続設定の実装

`backend/src/config/database.ts` を作成:

```typescript
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// データベース接続プール
export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.POSTGRES_USER || "vectoruser",
  password: process.env.POSTGRES_PASSWORD || "vectorpass",
  database: process.env.POSTGRES_DB || "vectordb",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 接続テスト
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}
```

### 3.5 エントリーポイントの作成

`backend/src/index.ts` を作成:

```typescript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testConnection } from "./config/database";
import apiRouter from "./routes/api";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());

// ヘルスチェック
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API ルート
app.use("/api", apiRouter);

// サーバー起動
async function startServer() {
  // DB接続確認
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error("Failed to connect to database. Exiting...");
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
}

startServer();
```

### ✅ Phase 3 完了チェックリスト

- [ ] `backend/package.json` が作成されている
- [ ] `backend/tsconfig.json` が作成されている
- [ ] `backend/Dockerfile` が作成されている
- [ ] `backend/src/config/database.ts` が作成されている
- [ ] `backend/src/index.ts` が作成されている
- [ ] `npm install` が正常に完了する

---

## Phase 3.5: Zod バリデーションの実装

API リクエストの入力値検証を型安全に行うため、Zod を導入します。

### 3.5.1 なぜ Zod を使うのか

| 観点                       | メリット                                 |
| -------------------------- | ---------------------------------------- |
| **型安全**                 | スキーマから TypeScript 型を自動推論     |
| **エラーメッセージ**       | 詳細で構造化されたエラー情報             |
| **拡張性**                 | ネストしたオブジェクト、配列の検証が容易 |
| **デファクトスタンダード** | TypeScript エコシステムで広く採用        |

### 3.5.2 バリデーションスキーマの作成

`backend/src/schemas/document.ts` を作成:

```typescript
import { z } from "zod";

/**
 * ドキュメント作成のバリデーションスキーマ
 */
export const createDocumentSchema = z.object({
  content: z
    .string({ required_error: "content は必須です" })
    .min(1, "content は1文字以上必要です")
    .max(10000, "content は10000文字以内にしてください"),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * 類似検索のバリデーションスキーマ
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
 * ドキュメントID のバリデーションスキーマ
 */
export const documentIdSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "ID は数値である必要があります")
    .transform((val) => parseInt(val, 10)),
});

// スキーマから型を自動推論
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type DocumentIdInput = z.infer<typeof documentIdSchema>;
```

### 3.5.3 バリデーションミドルウェアの作成

`backend/src/middleware/validate.ts` を作成:

```typescript
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Zod スキーマでリクエストボディを検証するミドルウェア
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: formatZodError(result.error),
      });
    }

    // 検証済みデータで上書き（デフォルト値が適用される）
    req.body = result.data;
    next();
  };
}

/**
 * Zod スキーマでリクエストパラメータを検証するミドルウェア
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: formatZodError(result.error),
      });
    }

    req.params = result.data as any;
    next();
  };
}

/**
 * ZodError を読みやすい形式に変換
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}
```

### 3.5.4 models/document.ts の更新

`backend/src/models/document.ts` を更新（スキーマからの型を活用）:

```typescript
import { CreateDocumentInput, SearchInput } from "../schemas/document";

export interface Document {
  id: number;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: Date;
}

// スキーマからの型を再エクスポート
export type { CreateDocumentInput, SearchInput };
```

### ✅ Phase 3.5 完了チェックリスト

- [ ] `backend/src/schemas/document.ts` が作成されている
- [ ] `backend/src/middleware/validate.ts` が作成されている
- [ ] `backend/src/models/document.ts` が更新されている
- [ ] Zod がインストールされている (`npm install zod`)

---

## Phase 4: OpenAI Embedding サービスの実装

### 4.1 Embedding サービスの作成

`backend/src/services/embedding.ts` を作成:

```typescript
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 使用するモデル
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536;

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * テキストをベクトル化する
 */
export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    return {
      embedding: response.data[0].embedding,
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  } catch (error) {
    console.error("Error creating embedding:", error);
    throw new Error("Failed to create embedding");
  }
}

/**
 * 複数のテキストを一括でベクトル化する
 */
export async function createEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    return response.data.map((item) => ({
      embedding: item.embedding,
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      },
    }));
  } catch (error) {
    console.error("Error creating embeddings:", error);
    throw new Error("Failed to create embeddings");
  }
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSION };
```

### 4.2 Embedding サービスのテスト（オプション）

ローカルでテストする場合:

```typescript
// backend/src/test-embedding.ts (テスト用、本番では削除)
import { createEmbedding } from "./services/embedding";

async function test() {
  const result = await createEmbedding("これはテストです");
  console.log("Embedding dimension:", result.embedding.length);
  console.log("Model:", result.model);
  console.log("Usage:", result.usage);
}

test();
```

### ✅ Phase 4 完了チェックリスト

- [ ] `backend/src/services/embedding.ts` が作成されている
- [ ] OpenAI API キーが正しく設定されている
- [ ] Embedding 生成が正常に動作する

---

## Phase 5: ベクトル検索機能の実装

### 5.1 ドキュメントモデルの作成

`backend/src/models/document.ts` を作成:

```typescript
export interface Document {
  id: number;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentInput {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: Date;
}
```

### 5.2 ベクトル検索サービスの作成

`backend/src/services/vector.ts` を作成:

```typescript
import { pool } from "../config/database";
import { createEmbedding } from "./embedding";
import {
  Document,
  CreateDocumentInput,
  SearchResult,
} from "../models/document";

/**
 * ドキュメントを追加（ベクトル化して保存）
 */
export async function addDocument(
  input: CreateDocumentInput
): Promise<Document> {
  const { content, metadata = {} } = input;

  // テキストをベクトル化
  const embeddingResult = await createEmbedding(content);
  const embeddingVector = `[${embeddingResult.embedding.join(",")}]`;

  // データベースに保存
  const query = `
    INSERT INTO documents (content, embedding, metadata)
    VALUES ($1, $2::vector, $3)
    RETURNING id, content, metadata, created_at, updated_at
  `;

  const result = await pool.query(query, [content, embeddingVector, metadata]);
  const row = result.rows[0];

  return {
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 全ドキュメントを取得
 */
export async function getAllDocuments(): Promise<Document[]> {
  const query = `
    SELECT id, content, metadata, created_at, updated_at
    FROM documents
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query);

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * ドキュメントを削除
 */
export async function deleteDocument(id: number): Promise<boolean> {
  const query = "DELETE FROM documents WHERE id = $1 RETURNING id";
  const result = await pool.query(query, [id]);
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * 類似ドキュメントを検索（コサイン類似度）
 */
export async function searchSimilar(
  queryText: string,
  limit: number = 5,
  threshold: number = 0.0
): Promise<SearchResult[]> {
  // クエリテキストをベクトル化
  const embeddingResult = await createEmbedding(queryText);
  const queryVector = `[${embeddingResult.embedding.join(",")}]`;

  // コサイン類似度で検索
  // pgvector の <=> 演算子はコサイン距離を返すので、1 から引いて類似度に変換
  const query = `
    SELECT 
      id, 
      content, 
      metadata, 
      created_at,
      1 - (embedding <=> $1::vector) as similarity
    FROM documents
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> $1::vector) >= $3
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `;

  const result = await pool.query(query, [queryVector, limit, threshold]);

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    similarity: parseFloat(row.similarity),
    createdAt: row.created_at,
  }));
}
```

### ✅ Phase 5 完了チェックリスト

- [ ] `backend/src/models/document.ts` が作成されている
- [ ] `backend/src/services/vector.ts` が作成されている
- [ ] ドキュメント追加機能が実装されている
- [ ] 類似検索機能が実装されている

---

## Phase 6: API エンドポイントの実装

### 6.1 API ルートの作成（Zod バリデーション適用版）

`backend/src/routes/api.ts` を作成:

```typescript
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
 * ドキュメントを追加
 */
router.post(
  "/documents",
  validateBody(createDocumentSchema),
  async (req: Request, res: Response) => {
    try {
      // バリデーション済みのデータを使用
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
 * 全ドキュメントを取得
 */
router.get("/documents", async (req: Request, res: Response) => {
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
 * ドキュメントを削除
 */
router.delete(
  "/documents/:id",
  validateParams(documentIdSchema),
  async (req: Request, res: Response) => {
    try {
      // バリデーション済み・変換済みのIDを使用
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
 * 類似検索
 */
router.post(
  "/search",
  validateBody(searchSchema),
  async (req: Request, res: Response) => {
    try {
      // バリデーション済み・デフォルト値適用済みのデータを使用
      const { query, limit, threshold } = req.body;
      const results = await searchSimilar(query, limit, threshold);
      res.json({
        query,
        count: results.length,
        results,
      });
    } catch (error) {
      console.error("Error searching documents:", error);
      res.status(500).json({ error: "Failed to search documents" });
    }
  }
);

export default router;
```

### 6.2 バリデーションエラーのレスポンス例

不正なリクエストを送信した場合のレスポンス例：

```bash
# 空のcontentで送信
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"content": ""}'
```

```json
{
  "error": "Validation failed",
  "details": {
    "content": ["content は1文字以上必要です"]
  }
}
```

```bash
# 無効なlimitで検索
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 500}'
```

```json
{
  "error": "Validation failed",
  "details": {
    "limit": ["limit は100以下にしてください"]
  }
}
```

### ✅ Phase 6 完了チェックリスト

- [ ] `backend/src/routes/api.ts` が作成されている
- [ ] POST /api/documents が実装されている
- [ ] GET /api/documents が実装されている
- [ ] DELETE /api/documents/:id が実装されている
- [ ] POST /api/search が実装されている

---

## Phase 7: Docker 統合と動作確認

### 7.1 docker-compose.yml の作成

ルートディレクトリに `docker-compose.yml` を作成:

```yaml
version: "3.8"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=db
      - DB_PORT=5432
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    build:
      context: ./db
      dockerfile: Dockerfile
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - ./db/init:/docker-entrypoint-initdb.d
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
```

### 7.2 コンテナのビルドと起動

```bash
# コンテナをビルド＆起動
docker-compose up -d --build

# ログを確認
docker-compose logs -f

# 起動状態を確認
docker-compose ps
```

### 7.3 動作確認

```bash
# 1. ヘルスチェック
curl http://localhost:3000/health

# 2. ドキュメントを追加
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"content": "TypeScriptは静的型付けのプログラミング言語です"}'

curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"content": "Pythonはシンプルで読みやすいプログラミング言語です"}'

curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"content": "PostgreSQLは強力なオープンソースのリレーショナルデータベースです"}'

# 3. 全ドキュメントを取得
curl http://localhost:3000/api/documents

# 4. 類似検索
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "プログラミング言語について教えて", "limit": 3}'

# 5. ドキュメントを削除
curl -X DELETE http://localhost:3000/api/documents/1
```

### 7.4 トラブルシューティング

```bash
# backendのログを確認
docker-compose logs -f backend

# DBに直接接続
docker-compose exec db psql -U vectoruser -d vectordb

# pgvector拡張の確認
docker-compose exec db psql -U vectoruser -d vectordb -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# テーブルの確認
docker-compose exec db psql -U vectoruser -d vectordb -c "\\dt"

# コンテナを停止
docker-compose down

# データも含めて完全削除
docker-compose down -v
```

### ✅ Phase 7 完了チェックリスト

- [ ] `docker-compose.yml` が作成されている
- [ ] `docker-compose up -d --build` が正常に完了する
- [ ] ヘルスチェックが正常に応答する
- [ ] ドキュメント追加が正常に動作する
- [ ] 類似検索が正常に動作する

---

## 🎉 実装完了

すべてのフェーズが完了したら、ベクトルデータベースアプリケーションの基本機能が動作する状態になります。

### 次のステップ（オプション）

1. **インデックスの追加**: データ量が増えたら `HNSW` または `IVFFlat` インデックスを追加
2. **認証機能の追加**: API キー認証や JWT 認証の実装
3. **レート制限**: OpenAI API コールのレート制限実装
4. **バッチ処理**: 大量ドキュメントの一括登録機能
5. **メタデータフィルタリング**: 検索時のメタデータによるフィルタリング
6. **AWS デプロイ**: ECS + RDS への本番デプロイ

詳細については [README.md](../README.md) を参照してください。
