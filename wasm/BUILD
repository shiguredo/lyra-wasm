load("@rules_cc//cc:defs.bzl", "cc_binary")
load("@emsdk//emscripten_toolchain:wasm_rules.bzl", "wasm_cc_binary")

cc_binary(
    name = "lyra",
    srcs = ["lyra.cc"],
    deps = [
        "@lyra//:lyra_encoder",
        "@lyra//:lyra_decoder",
    ],
    linkopts = [
      "--bind",
      "--use-preload-plugins",
      "-s ALLOW_MEMORY_GROWTH",
      "-s EXPORT_ES6=1",
      "-s MODULARIZE=1",
      "-s EXPORT_NAME=LyraWasmModule",

      # [FIXME]
      # "undefined symbol: _Unwind_GetIP (referenced by top-level compiled C/C++ code)" エラーを抑制するためのオプション
      # 対処法が判明したらこれは指定しないようにする
      "-s ERROR_ON_UNDEFINED_SYMBOLS=0",
    ],
)

wasm_cc_binary(
    name = "lyra-wasm",
    cc_target = ":lyra",
)
