#include <emscripten/bind.h>
#include <vector>

#include "lyra_encoder.h"

using namespace emscripten;
using namespace chromemedia::codec;

std::vector<uint8_t> returnBytes() {
  std::vector<uint8_t> v;
  return v;
}

std::vector<int16_t> newAudioData(size_t samples) {
  std::vector<int16_t> data(samples); // TODO
  return data;
}

EMSCRIPTEN_BINDINGS(lyra_encoder) {
  register_vector<uint8_t>("Bytes");
  register_vector<int16_t>("AudioData");

  function("returnBytes", &returnBytes);
  function("newAudioData", &newAudioData);

  class_<LyraEncoder>("LyraEncoder")
    .class_function("CreateWithRoot", &LyraEncoder::CreateWithRoot)
    .function("Encode", &LyraEncoder::Encode)
    .function("Encode2",
              optional_override([](LyraEncoder& self, std::vector<int16_t> audio_data) {
                auto result = self.LyraEncoder::Encode(absl::MakeSpan(audio_data));
                if (result) {
                  return val(*result);
                } else {
                  return val::undefined();
                }
              })
              );
}
