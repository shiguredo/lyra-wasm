import loadLyraWasmModule from "./lyra_wasm.js";
import * as lyra_wasm from "./lyra_wasm.js";

const MEMFS_MODEL_PATH = "/tmp/";

interface LyraEncoderOptions {
  sampleRate?: number;
  numberOfChannels?: number;
  bitrate?: number;
  enableDtx?: boolean;
}

interface LyraDecoderOptions {
  sampleRate?: number;
  numberOfChannels?: number;
}

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_BITRATE = 9200;
const DEFAULT_ENABLE_DTX = false;
const DEFAULT_CHANNELS = 1;

const FRAME_DURATION_MS = 20;

class LyraModule {
  private wasmModule: lyra_wasm.LyraWasmModule;

  private constructor(wasmModule: lyra_wasm.LyraWasmModule) {
    this.wasmModule = wasmModule;
  }

  static async load(wasmPath: string, modelPath: string): Promise<LyraModule> {
    const wasmModule = await loadLyraWasmModule({
      locateFile: (path) => {
        return trimLastSlash(wasmPath) + "/" + path;
      },
      preRun: (wasmModule) => {
        const fileNames = ["lyra_config.binarypb", "soundstream_encoder.tflite", "quantizer.tflite", "lyragan.tflite"];
        for (const fileName of fileNames) {
          const url = trimLastSlash(modelPath) + "/" + fileName;
          wasmModule.FS_createPreloadedFile(MEMFS_MODEL_PATH, fileName, url, true, false);
        }
      },
    });

    return new LyraModule(wasmModule);
  }

  createEncoder(options: LyraEncoderOptions = {}): LyraEncoder {
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
      return new LyraEncoder(encoder, buffer, options);
    }
  }

  createDecoder(options: LyraDecoderOptions = {}): LyraDecoder {
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
      return new LyraDecoder(decoder, buffer, options);
    }
  }
}

class LyraEncoder {
  private encoder: lyra_wasm.LyraWasmEncoder;
  private buffer: lyra_wasm.AudioData;

  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly bitrate: number;
  readonly enableDtx: boolean;

  readonly frameSize: number;

  constructor(encoder: lyra_wasm.LyraWasmEncoder, buffer: lyra_wasm.AudioData, options: LyraEncoderOptions) {
    this.encoder = encoder;
    this.buffer = buffer;

    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
    this.bitrate = options.bitrate || DEFAULT_BITRATE;
    this.enableDtx = options.enableDtx || DEFAULT_ENABLE_DTX;

    this.frameSize = buffer.size();
  }

  encode(audioData: Float32Array): Uint8Array | undefined {
    if (audioData.length !== this.frameSize) {
      throw new Error(
        `expected an audio data with ${this.frameSize} samples, but got one with ${audioData.length} samples`
      );
    }

    for (const [i, v] of audioData.entries()) {
      this.buffer.set(i, convertFloat32ToInt16(v));
    }

    const result = this.encoder.encode(this.buffer);
    if (result === undefined) {
      return undefined;
    } else {
      try {
        const encodedAudioData = new Uint8Array(result.size());
        for (let i = 0; i < encodedAudioData.length; i++) {
          encodedAudioData[i] = result.get(i);
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

class LyraDecoder {
  private decoder: lyra_wasm.LyraWasmDecoder;
  private buffer: lyra_wasm.Bytes;

  readonly sampleRate: number;
  readonly numberOfChannels: number;

  readonly frameSize: number;

  constructor(decoder: lyra_wasm.LyraWasmDecoder, buffer: lyra_wasm.Bytes, options: LyraDecoderOptions) {
    this.decoder = decoder;
    this.buffer = buffer;

    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;

    this.frameSize = (this.sampleRate * FRAME_DURATION_MS) / 1000;
  }

  decode(encodedAudioData: Uint8Array | undefined): Float32Array {
    if (encodedAudioData !== undefined) {
      this.buffer.clear();
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
      const audioData = new Float32Array(this.frameSize);
      for (let i = 0; i < this.frameSize; i++) {
        audioData[i] = convertInt16ToFloat32(result.get(i));
      }
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

function convertFloat32ToInt16(v: number): number {
  return Math.max(-32768, Math.min(Math.round(v * 0x7fff), 32767));
}

function convertInt16ToFloat32(v: number): number {
  return v / 0x7fff;
}

function trimLastSlash(s: string): string {
  if (s.slice(-1) === "/") {
    return s.slice(0, -1);
  }
  return s;
}

function checkSampleRate(n: number | undefined): void {
  switch (n) {
    case undefined:
    case 8000:
    case 16000:
    case 32000:
    case 48000:
      return;
  }
  throw new Error(`unsupported sample rate: expected one of 8000, 16000, 32000 or 48000, but got ${n}`);
}

function checkNumberOfChannels(n: number | undefined): void {
  switch (n) {
    case undefined:
    case 1:
      return;
  }
  throw new Error(`unsupported number of channels: expected 1, but got ${n}`);
}

function checkBitrate(n: number | undefined): void {
  switch (n) {
    case undefined:
    case 3200:
    case 6000:
    case 9200:
      return;
  }
  throw new Error(`unsupported bitrate: expected one of 3200, 6000 or 9200, but got ${n}`);
}

export { LyraModule, LyraDecoder, LyraEncoder, LyraEncoderOptions };
