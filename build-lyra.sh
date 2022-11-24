#!/bin/bash

set -eux

cd wasm/
bazel build -c opt --features=-wasm_warnings_as_errors :lyra-wasm
cd ../

rm -f src/lyra_wasm.js
cp wasm/bazel-bin/lyra-wasm/lyra.js src/lyra_wasm.js
