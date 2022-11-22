export interface LyraWasmEncoderClass {
  create(
    sampleRateHz: number,
    numChannels: number,
    bitrate: number,
    enableDtx: boolean,
    modelPath: string
  ): LyraWasmEncoder | undefined;
}

export interface LyraWasmEncoder {
  delete(): void;
}

export interface LyraWasmDecoderClass {
  create(sampleRateHz: number, numChannels: number, modelPath: string): LyraWasmDecoder | undefined;
}

export interface LyraWasmDecoder {
  delete(): void;
}

export interface LyraWasmModule extends EmscriptenModule {
  LyraEncoder: LyraWasmEncoderClass;
  LyraDecoder: LyraWasmDecoderClass;
  FS_createPreloadedFile(parent: string, name: string, url: string, canRead: boolean, canWrite: boolean): void;
}

export interface LoadLyraWasmModuleOptions {
  locateFile?: (path: string, prefix: string) => string;
  preRun?: (wasmModule: LyraWasmModule) => void;
}

export default function loadLyraWasmModule(options?: LoadLyraWasmModuleOptions): Promise<LyraWasmModule>;
