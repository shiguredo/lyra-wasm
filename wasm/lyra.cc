#include <emscripten/bind.h>

#include "lyra_encoder.h"

using namespace emscripten;
using namespace chromemedia::codec;

EMSCRIPTEN_BINDINGS(lyra_encoder) {
  class_<LyraEncoder>("LyraEcndoer")
    .class_function("Create", &LyraEncoder::Create);
}
