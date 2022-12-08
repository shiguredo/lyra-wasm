# 変更履歴

- UPDATE
    - 下位互換がある変更
- ADD
    - 下位互換がある追加
- CHANGE
    - 下位互換のない変更
- FIX
    - バグ修正

## develop

## 2022.2.0

- [CHANGE] サンプルレート・チャンネル数・ビットレートの取り得る値を型で明記する
  - @sile
- [CHANGE] デフォルトサンプルレートを 16000 に変更
  - @sile
- [CHANGE] 無駄な変換を最小限にするために encoder / decoder が float-32 ではなく int-16 で音声データをやりとりするようにする
  - @sile
- [UPDATE] google/lyra のバージョンを v1.3.1 に更新
  - @sile
- [ADD] LYRA_VERSION 定数を追加
  - @sile
- [UPDATE] JavaScript と WebAssembly 間での音声データ転送を高速化
  - @sile
- [CHANGE] LyraEncoder.encode() でエンコードに失敗した場合には undefined を返すのではなく例外を送出するようにする
  - @sile

## 2022.1.0

**初リリース**
