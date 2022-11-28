#include <string>
#include <vector>

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "lyra_encoder.h"
#include "lyra_decoder.h"

using namespace emscripten;
using namespace chromemedia::codec;

EMSCRIPTEN_BINDINGS(lyra) {
  register_vector<uint8_t>("Bytes");
  register_vector<int16_t>("AudioData");

  function("newAudioData", optional_override([](size_t n) { return std::vector<int16_t>(n); }));
  function("newBytes", optional_override([]() { return std::vector<uint8_t>(); }));

  class_<LyraEncoder>("LyraEncoder")
    .class_function("create",
                    optional_override([](int sample_rate_hz, int num_channels,
                                         int bitrate, bool enable_dtx,
                                         std::string model_path) {
                      return LyraEncoder::Create(sample_rate_hz, num_channels, bitrate, enable_dtx, model_path);
                    }))
    .function("encode",
              optional_override([](LyraEncoder& self, std::vector<int16_t>& audio_data) {
                auto result = self.LyraEncoder::Encode(absl::MakeSpan(audio_data));
                return result ? val(*result) : val::undefined();
              }))
    .function("setBitrate", &LyraEncoder::set_bitrate);

  class_<LyraDecoder>("LyraDecoder")
    .class_function("create",
                    optional_override([](int sample_rate_hz, int num_channels, std::string model_path) {
                      return LyraDecoder::Create(sample_rate_hz, num_channels, model_path);
                    }))
    .function("setEncodedPacket",
              optional_override([](LyraDecoder& self, std::vector<uint8_t>& encoded) {
                return self.LyraDecoder::SetEncodedPacket(absl::MakeSpan(encoded));
              }))
    .function("decodeSamples",
              optional_override([](LyraDecoder& self, int num_samples) {
                auto result = self.LyraDecoder::DecodeSamples(num_samples);
                return result ? val(*result) : val::undefined();
              }));
}
