load("@rules_cc//cc:defs.bzl", "cc_binary")
load("@emsdk//emscripten_toolchain:wasm_rules.bzl", "wasm_cc_binary")

# TODO
# package(features = ["-wasm_warnings_as_errors"])

LINKOPTS = [
    "--bind",  # Enable embind

    # TODO
    "-s ERROR_ON_UNDEFINED_SYMBOLS=0",

    # TODO: Consider to use INITIAL_MEMORY_SIZE instead
    "-sALLOW_MEMORY_GROWTH",
    # "-s EXPORT_ES6=1",

    "--use-preload-plugins",

    # "-sMODULARIZE",
    # TODO: "-sMODULARIZE",
]

config_setting(
    name = "release_opts",
    values = {"compilation_mode": "opt"},
)

config_setting(
    name = "debug_opts",
    values = {"compilation_mode": "dbg"},
)

cc_binary(
    name = "lyra",
    srcs = ["lyra.cc"],
    deps = [
        "@lyra//:lyra_encoder",
        "@lyra//:lyra_decoder",
    ],
    features = ["emcc_debug_link"],
    linkopts = LINKOPTS,
    # This target won't build successfully on its own because of missing emscripten
    # headers etc. Therefore, we hide it from wildcards.
    tags = ["manual"],
)

wasm_cc_binary(
    name = "lyra-wasm",
    cc_target = ":lyra",
)
