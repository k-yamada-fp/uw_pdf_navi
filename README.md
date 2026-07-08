# 引受目安PDFナビ

生命保険会社ごとの「引受目安PDF」について、病名・項目名から該当する保険会社資料・版・資料ページ・PDFページへたどり着くための静的Webサイトです。

このサイトは引受可否判定ではなく、原典ページへ案内するためのツールです。実際の引受可否は告知内容・診査・保険会社の査定結果によって決まります。

## 構成

Netlifyで静的公開する前提です。Express、SQLite、サーバーAPI、PDFアップロード、CSVインポートは使いません。

```text
public/
  index.html
  css/style.css
  js/app.js
  js/csv.js
  data/documents.csv
  data/toc_entries/
    orix_2025_12.csv
  pdfs/orix_2025_12.pdf
  vendor/pdfjs/
README.md
```

Netlifyでは publish directory を `public` にしてください。GitHubにpushすればNetlifyに反映される運用を想定しています。

## 簡易入口

トップ画面には、本格認証ではない簡易パスワード入口を置いています。

仮パスワードは `public/js/app.js` の次の定数で変更できます。

```js
const SIMPLE_ACCESS_PASSWORD = 'CHANGE_ME_PASSWORD';
```

認証済み状態は `sessionStorage` に保存されます。ブラウザを閉じると再入力が必要です。
PDFやCSVの直URLアクセス、開発者ツール、GitHub上のソース確認を防ぐものではありません。

## PDFを追加する方法

1. PDFファイルを `public/pdfs/` に置きます。
2. `public/data/documents.csv` に資料行を追加します。
3. `pdf_file` には `public/pdfs/` 配下のPDFファイル名を正確に書きます。
4. `public/data/toc_entries/{document_id}.csv` に索引CSVを置きます。
5. `enabled` を `1` にすると画面左のソース一覧に表示され、その `document_id` の索引CSVが読み込まれます。

PDFファイル名と `documents.csv` の `pdf_file` は完全に一致させてください。
`documents.csv` の `document_id` と、索引CSVファイル名 `{document_id}.csv` も一致させてください。

## documents.csv

```csv
document_id,company_name,document_name,version_label,pdf_file,document_page1_pdf_page,page_offset,enabled,sort_order
orix_2025_12,オリックス生命,引受目安,2025年12月版,orix_2025_12.pdf,1,0,1,1
```

- `document_id`: 資料ID
- `company_name`: 保険会社名
- `document_name`: 資料名
- `version_label`: 版ラベル
- `pdf_file`: PDFファイル名
- `document_page1_pdf_page`: 資料p.1がPDF上の何ページ目か
- `page_offset`: `pdf_page_number = document_page_number + page_offset`
- `enabled`: `1`なら表示、`0`なら非表示
- `sort_order`: 表示順

## toc_entries/{document_id}.csv

```csv
document_id,item_name,kana,document_page_number,pdf_page_number,source_type,memo,sort_order
orix_2025_12,胃潰瘍,イカイヨウ,76,76,傷病名索引,,8
```

索引CSVは `public/data/toc_entries/` 配下に資料ごとに分割して置きます。

```text
public/data/toc_entries/orix_2025_12.csv
```

ブラウザは `documents.csv` のうち `enabled=1` の資料を読み込み、各 `document_id` に対応する `data/toc_entries/{document_id}.csv` を初回にすべて取得して結合します。
未作成の索引CSVがあっても、その資料の索引だけ空配列として扱い、サイト全体は停止しません。

- `document_id`: `documents.csv` の `document_id`
- `item_name`: 検索対象となる項目名
- `kana`: 将来用・表示補助用。検索対象ではありません。
- `document_page_number`: 資料に印字されたページ番号
- `pdf_page_number`: 別タブでPDFを開くページ番号
- `source_type`: 傷病名索引、検査項目索引などの表示用
- `memo`: 任意メモ。検索対象ではありません。
- `sort_order`: 表示順

## 検索仕様

検索対象は各 `toc_entries/{document_id}.csv` の `item_name` のみです。
検索結果は保険会社ごとの見出しで区切って表示します。

検索対象にしないもの:

- `kana`
- `source_type`
- `memo`
- PDF本文
- 会社名
- 資料名
- 版

## page_offsetの考え方

今回の初期PDFは、資料p.1 = PDF p.1 のため `page_offset = 0` です。

将来的に資料p.1がPDF上の5ページ目から始まる場合は、次の関係になります。

```text
document_page1_pdf_page = 5
page_offset = 4
pdf_page_number = document_page_number + page_offset
```

ただし、この静的サイトでは各 `toc_entries/{document_id}.csv` に最終的な `pdf_page_number` を持たせます。検索結果のPDFリンクでは分割索引CSVの `pdf_page_number` を使います。

## ローカル確認

`public/index.html` を直接開くのではなく、静的サーバーで `public/` を配信して確認してください。

```bash
cd public
python -m http.server 8080
```

その後、ブラウザで `http://localhost:8080/` を開きます。

## 禁止していること

この静的サイトでは、PDF本文検索、OCR、AI要約、同義語検索、病名推測、顧客管理、DB導入、Express導入、サーバーAPI導入、PDFアップロード画面、CSVインポート画面、大規模な管理画面は使いません。
