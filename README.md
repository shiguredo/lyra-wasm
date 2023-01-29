# lyra-wasm

[![GitHub tag](https://img.shields.io/github/tag/shiguredo/lyra-wasm.svg)](https://github.com/shiguredo/lyra-wasm)
[![npm version](https://badge.fury.io/js/@shiguredo%2Flyra-wasm.svg)](https://badge.fury.io/js/@shiguredo%2Flyra-wasm)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Lyra V2 ([google/lyra]) という低ビットレート音声コーデックを WebAssembly にビルドして
ブラウザで使えるようにするためのライブラリです。

デモページ: https://shiguredo.github.io/lyra-wasm/recording.html

[google/lyra]: https://github.com/google/lyra

## 使い方

### JavaScript / TypeScript から利用する場合

以下のコマンドでパッケージがインストールできます:

```console
$ npm install --save @shiguredo/lyra-wasm
```

TypeScript での使用方法は次のようになります:

```typescript
import { LyraModule } from "@shiguredo/lyra-wasm";

// WebAssembly ファイルおよびモデルファイルが配置されているディレクトリの指定
// それぞれのファイルの取得方法は後述
const wasmPath = "./";
const modelPath = "./";

// 各種ファイルをロード
const lyraModule = await LyraModule.load(wasmPath, modelPath);

// エンコーダを生成
const lyraEncoder = await lyraModule.createEncoder({bitrate: 6000});

// デコーダを生成
const lyraDecoder = await lyraModule.createDecoder();

// エンコードおよびデコード
const audioData = new Float32Array(lyraEncoder.frameSize); // 無音の音声データを 1 フレーム分生成
const encoded = await lyraEncoder.encode(audioData);
const decoded = await lyraDecoder.decode(encoded);
```

### ブラウザから利用する場合

[examples/recording.html](examples/recording.html) に実際に動作する例があるので、そちらを参照してください。

### ビルド済み WebAssembly ファイルの取得方法

[リリースページ](https://github.com/shiguredo/lyra-wasm/releases)からビルド済みの lyra.wasm および lyra.worker.js ファイルが取得できます。

```console
$ curl -OL https://github.com/shiguredo/lyra-wasm/releases/download/2023.1.0/lyra.wasm
$ curl -OL https://github.com/shiguredo/lyra-wasm/releases/download/2023.1.0/lyra.worker.js
```

自前でビルドする場合には、以下のコマンドを実行してください。

```console
$ git clone https://github.com/shiguredo/lyra-wasm
$ cd lyra-wasm
$ npm install
$ npm run build
$ ls wasm/bazel-bin/lyra-wasm/lyra.wasm  wasm/bazel-bin/lyra-wasm/lyra.worker.js
```

### モデルファイルの取得方法

Lyra は機械学習ベースの音声コーデックなので、動作させるためには学習済みのモデルファイルが必要になります。
モデルファイルは [google/lyra] リポジトリで配布されており、以下のようにして取得できます。

```console
$ curl -OL https://github.com/google/lyra/raw/v1.3.0/model_coeffs/lyra_config.binarypb
$ curl -OL https://github.com/google/lyra/raw/v1.3.0/model_coeffs/lyragan.tflite
$ curl -OL https://github.com/google/lyra/raw/v1.3.0/model_coeffs/quantizer.tflite
$ curl -OL https://github.com/google/lyra/raw/v1.3.0/model_coeffs/soundstream_encoder.tflite
```

### 注意点

本ライブラリは WebAssembly のマルチスレッド機能を利用しているため、
デフォルトでは無効になっている SharedArrayBuffer クラスが使える必要があります。

このクラスは、本ライブラリを使用する HTML ドキュメントの HTTP 応答で、
以下のヘッダを指定することで有効になります。

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

## About Shiguredo's open source software

We will not respond to PRs or issues that have not been discussed on Discord. Also, Discord is only available in Japanese.

Please read https://github.com/shiguredo/oss/blob/master/README.en.md before use.

## 時雨堂のオープンソースソフトウェアについて

利用前に https://github.com/shiguredo/oss をお読みください。

## 使い方


## ライセンス

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

```
Copyright 2022-2023, Takeru Ohta (Original Author)
Copyright 2022-2023, Shiguredo Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

生成された wasm ファイルのライセンスについては [lyra/LICENSE](https://github.com/google/lyra) を参照してください。
