import loadLyraWasmModule from "./lyra_wasm.js";
import * as lyra_wasm from "./lyra_wasm.js";

const MEMFS_MODEL_PATH = "/tmp/";

interface LyraEncoderOptions {
  sampleRate?: number;
  numberOfChannels?: number;
  bitrate?: number;
  enableDtx?: boolean;
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

  createDecoder(sampleRateHz: number, numChannels: number): LyraDecoder | undefined {
    const decoder = this.wasmModule.LyraDecoder.create(sampleRateHz, numChannels, MEMFS_MODEL_PATH);
    if (decoder === undefined) {
      return undefined;
    } else {
      return new LyraDecoder(decoder);
    }
  }
}

class LyraEncoder {
  private encoder: lyra_wasm.LyraWasmEncoder;
  private buffer: lyra_wasm.AudioData;
  private bufferOffset: number;

  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly bitrate: number;
  readonly enableDtx: boolean;

  constructor(encoder: lyra_wasm.LyraWasmEncoder, buffer: lyra_wasm.AudioData, options: LyraEncoderOptions) {
    this.encoder = encoder;
    this.buffer = buffer;
    this.bufferOffset = 0;

    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || 1;
    this.bitrate = options.bitrate || DEFAULT_BITRATE;
    this.enableDtx = options.enableDtx || false;
  }

  encode(audioData: Float32Array): Array<Uint8Array | undefined> {
    let i = 0;
    let resultList = [];
    while (i < audioData.length) {
      this.buffer.set(this.bufferOffset, convertFloat32ToInt16(audioData[i]));
      this.bufferOffset++;
      if (this.bufferOffset == this.buffer.length) {
        this.bufferOffset = 0;

        const encodedBytes = this.encoder.encode(this.buffer);
        if (encodedBytes === undefined) {
          resultList.push(undefined);
        } else {
          const encoded = new Uint8Array(encodedBytes.length);
          for (let j = 0; j < encodedBytes.length; j++) {
            encoded[j] = encodedBytes.get(j);
          }
          resultList.push(encoded);
        }
      }
    }
    return resultList;
  }

  // TODO: setBitrate

  destroy(): void {
    this.encoder.delete();
  }
}

class LyraDecoder {
  private decoder: lyra_wasm.LyraWasmDecoder;

  constructor(decoder: lyra_wasm.LyraWasmDecoder) {
    this.decoder = decoder;
  }

  destroy(): void {
    this.decoder.delete();
  }
}

function convertFloat32ToInt16(v: number): number {
  return Math.max(-32768, Math.min(Math.round(v * 0x7fff), 32767));
}

export { LyraModule, LyraDecoder, LyraEncoder, LyraEncoderOptions };
