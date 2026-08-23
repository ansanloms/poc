# poc

## シークレットスキャン

[betterleaks](https://github.com/betterleaks/betterleaks) で git 履歴をスキャンし、AWS キー等の秘密情報が混入していないか検査する。push と pull request のたびに `.github/workflows/betterleaks.yml` が実行され、検出があれば job が失敗する。

ローカルで実行する場合:

```sh
betterleaks git . --redact -v --legacy-print
```

誤検知を抑止する場合は、`--legacy-print` で表示される `Fingerprint` の値を `.betterleaksignore` に 1 行ずつ追加する。
