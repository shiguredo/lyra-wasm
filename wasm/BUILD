load("@rules_cc//cc:defs.bzl", "cc_binary")
load("@emsdk//emscripten_toolchain:wasm_rules.bzl", "wasm_cc_binary")

cc_binary(
    name = "lyra",
    srcs = ["lyra.cc"],
    deps = [
        "@lyra//:lyra_encoder",
        "@lyra//:lyra_decoder",
    ],
)

wasm_cc_binary(
    name = "lyra-wasm",
    cc_target = ":lyra",
)
