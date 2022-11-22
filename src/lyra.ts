import loadLyraWasmModule from "./lyra_wasm.js";
import * as lyra_wasm from "./lyra_wasm.js";

const MEMFS_MODEL_PATH = "/tmp/";

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

  createEncoder(
    sampleRateHz: number,
    numChannels: number,
    bitrate: number,
    enableDtx: boolean
  ): LyraEncoder | undefined {
    const encoder = this.wasmModule.LyraEncoder.create(sampleRateHz, numChannels, bitrate, enableDtx, MEMFS_MODEL_PATH);
    if (encoder === undefined) {
      return undefined;
    } else {
      return new LyraEncoder(encoder);
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

  constructor(encoder: lyra_wasm.LyraWasmEncoder) {
    this.encoder = encoder;
  }

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

export { LyraModule, LyraDecoder, LyraEncoder };
