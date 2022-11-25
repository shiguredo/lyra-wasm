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

class LyraModule {
  private wasmModule: lyra_wasm.LyraWasmModule;

  private constructor(wasmModule: lyra_wasm.LyraWasmModule) {
    this.wasmModule = wasmModule;
  }

  static async load(wasmPath: string, modelPath: string): Promise<LyraModule> {
    const wasmModule = await loadLyraWasmModule({
      locateFile: (path, prefix) => {
        return wasmPath + path;
      },
      preRun: (wasmModule) => {
        const fileNames = ["lyra_config.binarypb", "soundstream_encoder.tflite", "quantizer.tflite", "lyragan.tflite"];
        for (const fileName of fileNames) {
          wasmModule.FS_createPreloadedFile(MEMFS_MODEL_PATH, fileName, modelPath + fileName, true, false);
        }
      },
    });

    return new LyraModule(wasmModule);
  }

  createEncoder(options: LyraEncoderOptions = {}): LyraEncoder | undefined {
    // TODO: validate
    const encoder = this.wasmModule.LyraEncoder.create(
      options.sampleRate || DEFAULT_SAMPLE_RATE,
      options.numberOfChannels || 1,
      options.bitrate || DEFAULT_BITRATE,
      options.enableDtx || false,
      MEMFS_MODEL_PATH
    );
    if (encoder === undefined) {
      // TODO: throw an exception
      return undefined;
    } else {
      const frameSize = (options.sampleRate || DEFAULT_SAMPLE_RATE) / 50; // 20 ms
      const buffer = this.wasmModule.newAudioData(frameSize);
      return new LyraEncoder(encoder, buffer, options);
    }
  }

  createDecoder(options: LyraDecoderOptions = {}): LyraDecoder | undefined {
    // TODO: validate
    const decoder = this.wasmModule.LyraDecoder.create(
      options.sampleRate || DEFAULT_SAMPLE_RATE,
      options.numberOfChannels || 1,
      MEMFS_MODEL_PATH
    );
    if (decoder === undefined) {
      return undefined; // TODO: exception
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
    this.numberOfChannels = options.numberOfChannels || 1;
    this.bitrate = options.bitrate || DEFAULT_BITRATE;
    this.enableDtx = options.enableDtx || false;

    this.frameSize = buffer.size();
  }

  encode(audioData: Float32Array): Uint8Array | undefined {
    // validate audioData.length

    for (const [i, v] of audioData.entries()) {
      this.buffer.set(i, convertFloat32ToInt16(v));
    }

    const result = this.encoder.encode(this.buffer);
    if (result === undefined) {
      return undefined;
    } else {
      const encodedAudioData = new Uint8Array(result.size());
      for (let i = 0; i < encodedAudioData.length; i++) {
        encodedAudioData[i] = result.get(i);
      }
      return encodedAudioData;
    }
  }

  // TODO: setBitrate

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
    this.numberOfChannels = options.numberOfChannels || 1;

    this.frameSize = this.sampleRate / 50; // 20 ms
  }

  decode(encodedAudioData: Uint8Array | undefined): Float32Array {
    if (encodedAudioData !== undefined) {
      this.buffer.clear();
      for (const v of encodedAudioData) {
        this.buffer.push_back(v);
      }
      if (!this.decoder.setEncodedPacket(this.buffer)) {
        throw Error("TODO");
      }
    }

    const result = this.decoder.decodeSamples(this.frameSize);
    if (result === undefined) {
      throw Error("TODO");
    }

    const audioData = new Float32Array(this.frameSize);

    for (let i = 0; i < this.frameSize; i++) {
      audioData[i] = convertInt16ToFloat32(result.get(i));
    }
    result.delete();

    return audioData;
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

export { LyraModule, LyraDecoder, LyraEncoder, LyraEncoderOptions };
