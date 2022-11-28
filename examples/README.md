Examples
========

実行手順
--------

```console
// ビルド
$ git clone https://github.com/shiguredo/lyra-wasm
$ cd lyra-wasm
$ npm install
$ npm run build

// モデルファイルの取得
$ cd examples/
$ curl -OL https://github.com/google/lyra/raw/v1.3.0/model_coeffs/lyra_config.binarypb
$ curl -OL https://github.com/google/lyra/raw/v1.3.0/model_coeffs/lyragan.tflite
$ curl -OL https://github.com/google/lyra/raw/v1.3.0/model_coeffs/quantizer.tflite
$ curl -OL https://github.com/google/lyra/raw/v1.3.0/model_coeffs/soundstream_encoder.tflite

// HTTP サーバの起動
// 起動後はブラウザで http://localhost:8080/examples/recording にアクセスする
$ cd ../
$ npm run start
```
