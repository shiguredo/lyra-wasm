export interface LyraWasmEncoderClass {
  create(
    sampleRateHz: number,
    numChannels: number,
    bitrate: number,
    enableDtx: boolean,
    modelPath: string
  ): LyraWasmEncoder;
}

export interface LyraWasmEncoder {}

export interface LyraWasmDecoderClass {
  create(sampleRateHz: number, numChannels: number, modelPath: string): LyraWasmDecoder;
}

export interface LyraWasmDecoder {}

export interface LyraWasmModule extends EmscriptenModule {
  LyraEncoder: LyraWasmEncoderClass;
  LyraDecoder: LyraWasmDecoderClass;
}

export interface LoadLyraWasmModuleOptions {
  locateFile?: (path: string, prefix: string) => string;
  preRun?: () => void;
}

export default function loadLyraWasmModule(options?: LoadLyraWasmModuleOptions): Promise<LyraWasmModule>;
