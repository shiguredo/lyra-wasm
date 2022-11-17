#!/bin/bash

set -eux

# Lyra
git clone https://github.com/google/lyra.git
cd lyra
git checkout v1.3.0
cd ..

# Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
