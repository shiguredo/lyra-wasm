import loadLyraWasmModule from "./lyra_wasm.js";
import * as lyra_wasm from "./lyra_wasm.js";

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
      preRun: () => {
        const fileNames = ["lyra_config.binarypb", "soundstream_encoder.tflite", "quantizer.tflite", "lyragan.tflite"];
        for (const fileName of fileNames) {
          // @ts-ignore
          LyraWasmModule.FS.createPreloadedFile(
            "/", // TODO: use a temp dir to avoid conflict(?)
            fileName,
            modelPath + fileName,
            true,
            false
          );
        }
      },
    });

    return new LyraModule(wasmModule);
  }

  createEncoder(sampleRateHz: number, numChannels: number, bitrate: number, enableDtx: boolean): LyraEncoder {
    return this.wasmModule.LyraEncoder.create(sampleRateHz, numChannels, bitrate, enableDtx, "/");
  }

  createDecoder(sampleRateHz: number, numChannels: number): LyraDecoder {
    return this.wasmModule.LyraDecoder.create(sampleRateHz, numChannels, "/");
  }
}

class LyraEncoder {}

class LyraDecoder {}

export { LyraModule, LyraDecoder, LyraEncoder };
