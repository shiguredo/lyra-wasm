#include <emscripten/bind.h>
#include <vector>

#include "lyra_encoder.h"

using namespace emscripten;
using namespace chromemedia::codec;

absl::Span<const int16_t> makeSpan(std::vector<int16_t> audio_data) {
  return absl::MakeSpan(audio_data);
}

std::vector<uint8_t> returnBytes() {
  std::vector<uint8_t> v;
  return v;
}

EMSCRIPTEN_BINDINGS(lyra_encoder) {
  register_vector<uint8_t>("Bytes");
  register_vector<int16_t>("AudioData");

  function("returnBytes", &returnBytes);

  class_<LyraEncoder>("LyraEncoder")
    .class_function("CreateWithRoot", &LyraEncoder::CreateWithRoot)
    .class_function("CreateFromBuffers", &LyraEncoder::CreateFromBuffers)
    .function("Encode", &LyraEncoder::Encode);
    // .function("Encode", &LyraEncoder::Encode,
    //           optional_override([](LyraEncoder& self, std::vector<int16_t> audio_data) {
    //             return self.LyraEncoder::Encode(absl::MakeSpan(audio_data));
    //           })
    //           );

  function("makeSpan", makeSpan, allow_raw_pointers());
}
