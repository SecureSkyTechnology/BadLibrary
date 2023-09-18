# BadLibrary - 脆弱性を試すためのサンプルWebアプリケーション 

BadLibraryは初めて脆弱性を探すのに最適な、小さくて簡単に動かせる脆弱なサンプルWebアプリケーションです。
node.jsだけ入っていれば特にそれ以外には何も必要なく動くので、BadStoreなどのようにVM環境を用意する必要もありません。

また、Webアプリケーションとして最小限の機能のみを備えているため、全体像の把握もしやすくなっています。

## インストール

	% git clone https://github.com/SecureSkyTechnology/BadLibrary
    % cd BadLibrary/src
	% npm install

## 起動

単純に src/app.js を起動するだけです。デフォルトでは8080でlistenします。

    % npm start 

または

    % node app.js

で起動するので、Webブラウザで `http://127.0.0.1:8080` などへアクセスしてください。

引数として `-p` または `--port` でポート番号を、 `-h` または `--host` でlistenするホストアドレスを指定することができます。

    % node app.js -p 80
    % node app.js --port 8080 --host 127.0.0.1

また、`-c` あるいは `--config` で設定ファイルを指定できます。省略時は同一ディレクトリ内の `config.json` が読み込まれます。

    % node app.js --config /tmp/config.json

デフォルトでユーザー名 `user`　パスワード `pass` でBASIC認証がかけられています。BASIC認証が不要な場合は設定ファイルを編集してください。

また、利用できるユーザーは複数登録されていますが、利用者(練習用)としてはメールアドレス `akita@example.jp` 暗証番号 `1234` を利用するといいでしょう。それ以外のアカウントについては、脆弱性を利用して利用してみましょう。

## 設定ファイル

設定ファイル `config.json` にて、サイト自体へのBASIC認証有無や含まれる脆弱性の有効無効を設定できます。

    {
        "global" : {
            "basic" : "user:1234" // BASIC認証のユーザー名とパスワード
        },
        "vulnerabilities" : {
            "sqli" : ["auth", "search", "blind"],          // SQLインジェクション 
            "xss" : ["reflect", "dom" ],                   // XSS
            "session" : [ "no-refresh", "no-httponly", "serial" ], //セッション情報の不備
            "expose" : ["contaft", "dirindex", "admin"],   // 情報の露出
            "xxe" : true,                                  // XXE
            "csrf" : true,                                 // CSRF
            "racecondition" : true                         // レースコンディション
        }
    }

- `global.basic` にユーザー名とパスワードを指定すると、BASIC認証が有効となりBadLibraryのサイトへアクセスする際にユーザー名とパスワードの入力を求められます。
- `vulnerabilities.sqli` の要素に `"auth"` を指定するとログイン画面のSQLインジェクションが有効となりSQLインジェクションによって認証をバイパスできます。
- `vulnerabilities.sqli` の要素に `"search"` を指定すると貸し出し履歴の画面でのSQLインジェクションが有効となります。
- `vulnerabilities.sqli` の要素に `"blind"` を指定すると書籍情報の画面でブラインドSQLインジェクションが有効になります。
- `vulnerabilities.xss` の要素に `"reflect"` を指定すると貸し出し履歴の画面での反射型XSSが有効になります。
- `vulnerabilities.xss` の要素に `"dom"` を指定すると404エラーページでのDOM-baed XSSが有効になります。
- `vulnerabilities.session` の要素に `"no-refresh"` を指定すると、ログイン後もセッションIDが変更されなくなります。
- `vulnerabilities.session` の要素に `"no-httponly"` を指定すると、セッションIDにhttponly属性が付与されなくなります。
- `vulnerabilities.session` の要素に `"serial"` を指定すると、セッションIDがハッシュ値ではなく連番で発行されるようになります。
- `vulnerabilities.expose` の要素に `"contact"` を指定すると、お問い合わせの内容のログが閲覧可能になります。(このオプションが指定されない場合はお問い合わせ内容は一切記録されません。)
- `vulnerabilities.expose` の要素に `"dirindex"` を指定すると、お問い合わせログのディレクトリインデックスが有効になります。`vulnerabilities.expose = ["contact"]` も同時に指定する必要があります。
- `vulnerabilities.expose` の要素に `"admin"` を指定すると、誰でもログイン無しに管理画面にアクセス可能になります。
- `vulnerabilities.xxe` に `true` を指定すると、管理画面での書籍登録でXXEが有効になります。`vulnerabilities.expose = ["admin"]` も同時に指定する必要があります。(libxml.jsのバージョンによっては期待通りの挙動とならない可能があります)
- `vulnerabilities.csrf` に `true` を指定すると、お問い合わせ画面等でCSRFが有効になります。
- `vulnerabilities.racecondition` に `true` を指定すると、お問い合わせ画面でレースコンディションが有効になります。

## 安全性

BadLibraryには、OSコマンドインジェクションのように環境を破壊するものは含まれていません。また、データベースもreadonlyで開いていますのでデータベースが壊れるといったことも発生しません。そのため、1台のサーバーに対して複数人で同時にアクセスしても環境が壊れて診断が継続できなくなるということは通常はありません。
ただし、BadLibraryを誰でもアクセス可能な状態で公開する場合には以下の点に気をつけてください。

- `vulnerabilities.xxe = true` を指定してXXEが有効になっている場合には、サーバー上の機密情報が漏洩する可能性があります。
- `vulnerabilities.expose = ["contact"]` を指定してお問い合わせログを閲覧可能にしている場合には、お問い合わせ内容として書き込んだ内容が漏洩する可能性があります。また、大量の書き込みによってサーバー上のディスクも消費する可能性があります。

これら以外にも、意図していない本来の意味での脆弱性が含まれる可能性もあります。

## ライセンス

 This software is released under the MIT License, see LICENSE.txt.

