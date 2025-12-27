# Vector DB Test Application

TypeScript + OpenAI Embedding + pgvector を使用したベクトルデータベースのテストアプリケーション

## 📁 プロジェクト構成

```
test-vector/
├── docker-compose.yml          # Docker Compose設定（backend + db）
├── .env.example                 # 環境変数テンプレート
├── .env                         # 環境変数（git管理外）
├── README.md
│
├── backend/                     # TypeScriptアプリケーション
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts             # エントリーポイント
│       ├── config/
│       │   └── database.ts      # DB接続設定
│       ├── services/
│       │   ├── embedding.ts     # OpenAI Embedding サービス
│       │   └── vector.ts        # ベクトル検索サービス
│       ├── models/
│       │   └── document.ts      # ドキュメントモデル
│       └── routes/
│           └── api.ts           # APIルート
│
└── db/                          # PostgreSQL + pgvector
    ├── Dockerfile
    └── init/
        └── 01_init.sql          # DB初期化スクリプト（pgvector拡張 + テーブル作成）
```

## 🛠 技術スタック

| コンポーネント | 技術                                |
| -------------- | ----------------------------------- |
| Backend        | TypeScript, Node.js, Express        |
| Validation     | Zod                                 |
| Embedding      | OpenAI API (text-embedding-3-small) |
| Database       | PostgreSQL + pgvector               |
| Container      | Docker, Docker Compose              |

## 🚀 セットアップ手順

### 1. 環境変数の設定

```bash
# ルートディレクトリの.envを作成
cp .env.example .env

# OpenAI APIキーを設定
# .env ファイルを編集してAPIキーを入力
```

### 2. Docker コンテナの起動

```bash
# コンテナをビルド＆起動
docker-compose up -d --build

# ログを確認
docker-compose logs -f
```

### 3. 動作確認

```bash
# ヘルスチェック
curl http://localhost:3000/health

# テキストをベクトル化して保存
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"content": "これはテストドキュメントです"}'

# 類似検索
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "テスト", "limit": 5}'
```

## 📝 環境変数

### ルート `.env`

```env
# PostgreSQL
POSTGRES_USER=vectoruser
POSTGRES_PASSWORD=vectorpass
POSTGRES_DB=vectordb

# OpenAI
OPENAI_API_KEY=sk-your-api-key-here
```

## 🐳 Docker 構成

### docker-compose.yml

- **backend**: Node.js TypeScript アプリケーション
  - ポート: 3000
  - db コンテナに依存
- **db**: PostgreSQL + pgvector
  - ポート: 5432
  - 初期化時に `db/init/` 内の SQL スクリプトを実行

### 各コンテナの役割

| サービス | イメージ               | ポート | 説明         |
| -------- | ---------------------- | ------ | ------------ |
| backend  | node:20-alpine         | 3000   | API サーバー |
| db       | pgvector/pgvector:pg16 | 5432   | ベクトル DB  |

## 📚 API エンドポイント

| メソッド | エンドポイント       | 説明                                     |
| -------- | -------------------- | ---------------------------------------- |
| GET      | `/health`            | ヘルスチェック                           |
| POST     | `/api/documents`     | ドキュメントを追加（ベクトル化して保存） |
| GET      | `/api/documents`     | 全ドキュメントを取得                     |
| POST     | `/api/search`        | 類似検索                                 |
| DELETE   | `/api/documents/:id` | ドキュメントを削除                       |

## 🔧 開発コマンド

```bash
# コンテナ起動
docker-compose up -d --build

# コンテナ停止
docker-compose down

# DBデータも含めて完全削除
docker-compose down -v

# backendのログを確認
docker-compose logs -f backend

# DBに直接接続
docker-compose exec db psql -U vectoruser -d vectordb
```

## 📖 pgvector について

pgvector は PostgreSQL の拡張機能で、ベクトル類似性検索を提供します。

### 主な機能

- ベクトルデータ型 (`vector`)
- 類似性演算子
  - `<->` : L2 距離（ユークリッド距離）
  - `<#>` : 内積（負の値）
  - `<=>` : コサイン距離

### インデックス

```sql
-- IVFFlatインデックス（高速な近似検索）
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- HNSWインデックス（より高精度な近似検索）
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
```

## 🎯 OpenAI Embedding

このアプリでは `text-embedding-3-small` モデルを使用します。

| モデル                 | 次元数 | 用途           |
| ---------------------- | ------ | -------------- |
| text-embedding-3-small | 1536   | コスト効率重視 |
| text-embedding-3-large | 3072   | 高精度重視     |

## ☁️ AWS 本番環境への移行

### RDS PostgreSQL + pgvector 対応状況

**✅ Amazon RDS for PostgreSQL は pgvector をサポートしています！**

| 項目              | 内容                                    |
| ----------------- | --------------------------------------- |
| サポート開始      | 2023 年 5 月〜                          |
| 対応バージョン    | PostgreSQL 15.2+, 14.7+, 13.10+, 12.14+ |
| Aurora PostgreSQL | 対応済み ✅                             |
| 有効化方法        | `CREATE EXTENSION vector;`              |

### 本番構成イメージ（ECS + RDS）

```mermaid
flowchart LR
  %% AWS production reference architecture (ECS + RDS)
  ALB["ALB<br/>(HTTPS)"] --> ECS["ECS Cluster<br/>(Fargate)"]
  ECS --> API["backend Task<br/>(TypeScript API)"]
  API --> RDS[("RDS PostgreSQL<br/>+ pgvector extension<br/>(Multi-AZ / マネージド)")]
  API -. uses secrets .-> SM["Secrets Manager<br/>- DB credentials<br/>- OpenAI API Key"]
```

### 環境ごとの構成

| 環境         | Database          | Backend          | 用途         |
| ------------ | ----------------- | ---------------- | ------------ |
| ローカル開発 | Docker (pgvector) | Docker (Node.js) | 開発・テスト |
| 本番 (AWS)   | RDS PostgreSQL    | ECS Fargate      | 本番運用     |

### この構成のメリット

1. **ローカル開発と本番で同じ技術スタック**

   - pgvector は RDS でも Docker でも同じ SQL で動作
   - コード変更なしで環境を切り替え可能

2. **接続先の切り替えは環境変数のみ**

   ```env
   # ローカル
   DATABASE_URL=postgresql://user:pass@localhost:5432/vectordb

   # 本番 (RDS)
   DATABASE_URL=postgresql://user:pass@xxx.rds.amazonaws.com:5432/vectordb
   ```

3. **RDS のマネージドサービスの恩恵**
   - 自動バックアップ
   - Multi-AZ による高可用性
   - パフォーマンスインサイト
   - 自動スケーリング（Aurora の場合）

### RDS でのセットアップ手順

```sql
-- RDS に接続後、pgvector 拡張を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- 初期化 SQL（db/init/01_init.sql）をそのまま実行可能
```

### Aurora vs RDS どちらを選ぶ？

| 項目             | RDS PostgreSQL      | Aurora PostgreSQL |
| ---------------- | ------------------- | ----------------- |
| コスト           | 安い                | やや高い          |
| スケーラビリティ | 手動                | 自動              |
| 可用性           | Multi-AZ で高可用性 | より高い可用性    |
| 推奨ケース       | 小〜中規模          | 大規模・高負荷    |

**推奨**: まずは RDS PostgreSQL で始めて、必要に応じて Aurora に移行

## ⚠️ 注意事項

- OpenAI API の利用には料金が発生します
- `.env` ファイルは Git 管理外にしてください
- 本番環境ではパスワードを強固なものに変更してください
- 本番環境では Secrets Manager で認証情報を管理することを推奨

## 📄 ライセンス

MIT License
