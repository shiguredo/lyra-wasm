import loadLyraWasmModule from "./lyra_wasm.js";
import * as lyra_wasm from "./lyra_wasm.js";

const MEMFS_MODEL_PATH = "/tmp/";

class LyraModule {
  wasmModule: lyra_wasm.LyraWasmModule;

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
    return this.wasmModule.LyraEncoder.create(sampleRateHz, numChannels, bitrate, enableDtx, MEMFS_MODEL_PATH);
  }

  createDecoder(sampleRateHz: number, numChannels: number): LyraDecoder | undefined {
    return this.wasmModule.LyraDecoder.create(sampleRateHz, numChannels, MEMFS_MODEL_PATH);
  }
}

class LyraEncoder {}

class LyraDecoder {}

export { LyraModule, LyraDecoder, LyraEncoder };
