import loadLyraWasmModule from "./lyra_wasm.js";
import * as lyra_wasm from "./lyra_wasm.js";

class LyraModule {
  wasmModule: lyra_wasm.LyraWasmModule;

  private constructor(wasmModule: lyra_wasm.LyraWasmModule) {
    this.wasmModule = wasmModule;
  }

  static async load(wasmPath: string /* TODO: , modelPath: string*/): Promise<LyraModule> {
    const wasmModule = await loadLyraWasmModule({
      locateFile: (path, prefix) => {
        return wasmPath + path;
      },
    });

    return new LyraModule(wasmModule);
  }

  createEncoder(): LyraEncoder {
    return new LyraEncoder();
  }

  createDecoder(): LyraDecoder {
    return new LyraDecoder();
  }
}

class LyraEncoder {}

class LyraDecoder {}

export { LyraModule, LyraDecoder, LyraEncoder };
