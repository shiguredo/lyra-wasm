wasm
====

[google/lyra](https://github.com/google/lyra) を WebAssembly にビルドするための Bazel プロジェクトです。

ビルド方法
----------

```console
// ビルド
$ bazel build -c opt --features=-wasm_warnings_as_errors :lyra-wasm

// 生成されたファイルを確認
$ find  wasm/bazel-bin/lyra-wasm/ -size +1c -type f | xargs wc -c
 3188775 wasm/bazel-bin/lyra-wasm//lyra.wasm
  171686 wasm/bazel-bin/lyra-wasm//lyra.js
    3051 wasm/bazel-bin/lyra-wasm//lyra.worker.js
 3363512 total
```
