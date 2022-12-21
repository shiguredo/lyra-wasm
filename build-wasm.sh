#!/bin/bash

if [ -e src/lyra_wasm.js ]
then
  exit 0
fi

set -eux

cd wasm/
pip install --user numpy
bazelisk build -c opt --features=-wasm_warnings_as_errors :lyra-wasm
cd ../

cp wasm/bazel-bin/lyra-wasm/lyra.js src/lyra_wasm.js
