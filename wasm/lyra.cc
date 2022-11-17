#include <emscripten/bind.h>

#include "lyra_encoder.h"

using namespace emscripten;
using namespace chromemedia::codec;

absl::Span<const int16_t> makeConstSpan(const int16_t *audio, size_t length) {
  return absl::MakeConstSpan(audio,length);
}

EMSCRIPTEN_BINDINGS(lyra_encoder) {
  class_<LyraEncoder>("LyraEcndoer")
    .class_function("CreateFromBuffers", &LyraEncoder::CreateFromBuffers, allow_raw_pointers())
    .function("Encode", &LyraEncoder::Encode);

  function("makeConstSpan", makeConstSpan, allow_raw_pointers());
}
