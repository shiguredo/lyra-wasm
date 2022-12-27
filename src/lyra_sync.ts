import loadLyraWasmModule from "./lyra_wasm.js";
import * as lyra_wasm from "./lyra_wasm.js";

import {
  LYRA_VERSION,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_BITRATE,
  DEFAULT_ENABLE_DTX,
  DEFAULT_CHANNELS,
  LyraDecoderOptions,
  LyraEncoderOptions,
  trimLastSlash,
  checkSampleRate,
  checkNumberOfChannels,
  checkBitrate,
} from "./utils";

const MEMFS_MODEL_PATH = "/tmp/";
const FRAME_DURATION_MS = 20;

class LyraSyncModule {
  private wasmModule: lyra_wasm.LyraWasmModule;

  private constructor(wasmModule: lyra_wasm.LyraWasmModule) {
    this.wasmModule = wasmModule;
  }

  static async load(wasmPath: string, modelPath: string): Promise<LyraSyncModule> {
    const wasmModule = await loadLyraWasmModule({
      locateFile: (path) => {
        return trimLastSlash(wasmPath) + "/" + path;
      },
    });

    const modelFileNames = ["lyra_config.binarypb", "soundstream_encoder.tflite", "quantizer.tflite", "lyragan.tflite"];
    await Promise.all(
      modelFileNames.map((name) => {
        const url = trimLastSlash(modelPath) + "/" + name;
        return fetch(url).then(async (res) => {
          if (!res.ok) {
            throw new Error(`failed to fetch ${url}: ${res.status} ${res.statusText}`);
          }

          wasmModule.FS_createDataFile(
            MEMFS_MODEL_PATH,
            name,
            new Uint8Array(await res.arrayBuffer()),
            true,
            false,
            false
          );
        });
      })
    );

    return new LyraSyncModule(wasmModule);
  }

  createEncoder(options: LyraEncoderOptions = {}): LyraSyncEncoder {
    checkSampleRate(options.sampleRate);
    checkNumberOfChannels(options.numberOfChannels);
    checkBitrate(options.bitrate);

    const encoder = this.wasmModule.LyraEncoder.create(
      options.sampleRate || DEFAULT_SAMPLE_RATE,
      options.numberOfChannels || DEFAULT_CHANNELS,
      options.bitrate || DEFAULT_BITRATE,
      options.enableDtx || DEFAULT_ENABLE_DTX,
      MEMFS_MODEL_PATH
    );
    if (encoder === undefined) {
      throw new Error("failed to create lyra encoder");
    } else {
      const frameSize = ((options.sampleRate || DEFAULT_SAMPLE_RATE) * FRAME_DURATION_MS) / 1000;
      const buffer = this.wasmModule.newAudioData(frameSize);
      return new LyraSyncEncoder(this.wasmModule, encoder, buffer, options);
    }
  }

  createDecoder(options: LyraDecoderOptions = {}): LyraSyncDecoder {
    checkSampleRate(options.sampleRate);
    checkNumberOfChannels(options.numberOfChannels);

    const decoder = this.wasmModule.LyraDecoder.create(
      options.sampleRate || DEFAULT_SAMPLE_RATE,
      options.numberOfChannels || DEFAULT_CHANNELS,
      MEMFS_MODEL_PATH
    );
    if (decoder === undefined) {
      throw new Error("failed to create lyra decoder");
    } else {
      const buffer = this.wasmModule.newBytes();
      return new LyraSyncDecoder(this.wasmModule, decoder, buffer, options);
    }
  }
}

class LyraSyncEncoder {
  private wasmModule: lyra_wasm.LyraWasmModule;
  private encoder: lyra_wasm.LyraWasmEncoder;
  private buffer: lyra_wasm.AudioData;
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly bitrate: number;
  readonly enableDtx: boolean;
  readonly frameSize: number;

  constructor(
    wasmModule: lyra_wasm.LyraWasmModule,
    encoder: lyra_wasm.LyraWasmEncoder,
    buffer: lyra_wasm.AudioData,
    options: LyraEncoderOptions
  ) {
    this.wasmModule = wasmModule;
    this.encoder = encoder;
    this.buffer = buffer;

    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
    this.bitrate = options.bitrate || DEFAULT_BITRATE;
    this.enableDtx = options.enableDtx || DEFAULT_ENABLE_DTX;
    this.frameSize = buffer.size();
  }

  encode(audioData: Int16Array): Uint8Array | undefined {
    if (audioData.length !== this.frameSize) {
      throw new Error(
        `expected an audio data with ${this.frameSize} samples, but got one with ${audioData.length} samples`
      );
    }

    this.wasmModule.copyInt16ArrayToAudioData(this.buffer, audioData);

    const result = this.encoder.encode(this.buffer);

    if (result === undefined) {
      throw new Error("failed to encode");
    } else {
      try {
        const encodedAudioData = new Uint8Array(result.size());
        for (let i = 0; i < encodedAudioData.length; i++) {
          encodedAudioData[i] = result.get(i);
        }

        if (encodedAudioData.length === 0) {
          // DTX が有効、かつ、 audioData が無音ないしノイズだけを含んでいる場合にはここに来る
          return undefined;
        }
        return encodedAudioData;
      } finally {
        result.delete();
      }
    }
  }

  setBitrate(bitrate: number): void {
    checkBitrate(bitrate);

    if (!this.encoder.setBitrate(bitrate)) {
      throw new Error(`failed to update bitrate from ${this.bitrate} to ${bitrate}`);
    }
  }

  destroy(): void {
    this.encoder.delete();
    this.buffer.delete();
  }
}

class LyraSyncDecoder {
  private wasmModule: lyra_wasm.LyraWasmModule;
  private decoder: lyra_wasm.LyraWasmDecoder;
  private buffer: lyra_wasm.Bytes;
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly frameSize: number;

  constructor(
    wasmModule: lyra_wasm.LyraWasmModule,
    decoder: lyra_wasm.LyraWasmDecoder,
    buffer: lyra_wasm.Bytes,
    options: LyraDecoderOptions
  ) {
    this.wasmModule = wasmModule;
    this.decoder = decoder;
    this.buffer = buffer;

    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;

    this.frameSize = (this.sampleRate * FRAME_DURATION_MS) / 1000;
  }

  decode(encodedAudioData: Uint8Array | undefined): Int16Array {
    if (encodedAudioData !== undefined) {
      this.buffer.resize(0, 0); // clear() を使うと「関数が存在しない」というエラーが出るので resize() で代用
      for (const v of encodedAudioData) {
        this.buffer.push_back(v);
      }
      if (!this.decoder.setEncodedPacket(this.buffer)) {
        throw new Error("failed to set encoded packet");
      }
    }

    const result = this.decoder.decodeSamples(this.frameSize);

    if (result === undefined) {
      throw Error("failed to decode samples");
    }
    try {
      const audioData = new Int16Array(this.frameSize);
      this.wasmModule.copyAudioDataToInt16Array(audioData, result);
      return audioData;
    } finally {
      result.delete();
    }
  }

  destroy(): void {
    this.decoder.delete();
    this.buffer.delete();
  }
}

export { LyraSyncModule, LyraSyncDecoder, LyraSyncEncoder, LyraEncoderOptions, LyraDecoderOptions, LYRA_VERSION };
