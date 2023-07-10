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

- [ADD] CI に nodejs 20 を追加
  - @voluntas
- [CHANGE] .prettierrc.json の設定を統一仕様に合わせる
  - @voluntas
- [CHANGE] pnpm 化
  - CI に pnpm actions 追加
  - @voluntas

## 2023.1.0

- [UPDATE] LyraEncoder および LyraDecoder を web worker に転送するために必要なクラスと関数を追加
  - 以下のインターフェースが追加された:
    - `LyraEncoderState`
    - `LyraDecoderState`
  - 以下のメソッドが追加された:
    - `LyraEncoder.fromState()`
    - `LyraDecoder.fromState()`
  - これらは `LyraEncoder` および `LyraDecoder` を `postMessage()` を使って web worker に転送するとメソッド情報が捨てられ `LyraEncoderState` および `LyraDecoderState` が得られるが、それらに対して `fromState()` を呼び出すことで、元のインスタンスが復元できる
  - @sile
- [UPDATE] SampleRate, NumberOfChannels, Bitrate 型を定義
  - @sile
- [CHANGE] エンコードおよびデコードを web worker で行うようにする
  - 以下のメソッドが非同期になった:
    - `LyraModule.createEncoder()`
    - `LyraModule.createDecoder()`
    - `LyraEncoder.encode()`
    - `LyraDecoder.decode()`
  - 以下のメソッドが廃止された:
    - `LyraEncoder.setBitrate()`
  - 以下の readonly プロパティが追加された:
    - `LyraEncoder.port` (`MessagePort` 型)
    - `LyraDecoder.port` (`MessagePort` 型)
  - @sile
- [CHANGE] emscripten のビルドオプションから `ALLOW_MEMORY_GROWTH` を外して `INITIAL_MEMORY=64MB` を追加
  - モバイル Safari では `ALLOW_MEMORY_GROWTH` オプション付きでビルドされた wasm ファイルはエラーになるため
  - @sile
- [UPDATE] google/lyra のバージョンを 1.3.2 に更新
  - @sile

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
