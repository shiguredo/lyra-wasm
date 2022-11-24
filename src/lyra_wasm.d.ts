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
  encode(audioData: AudioData): Bytes | undefined;
  delete(): void;
}

export interface LyraWasmDecoderClass {
  create(sampleRateHz: number, numChannels: number, modelPath: string): LyraWasmDecoder | undefined;
}

export interface LyraWasmDecoder {
  setEncodedPacket(encodedAudioData: Bytes): boolean;
  decodeSamples(numSamples: number): AudioData | undefined;
  delete(): void;
}

export interface LyraWasmModule extends EmscriptenModule {
  LyraEncoder: LyraWasmEncoderClass;
  LyraDecoder: LyraWasmDecoderClass;
  newAudioData(numberOfSamples: number): AudioData;
  newBytes(): Bytes;
  FS_createPreloadedFile(parent: string, name: string, url: string, canRead: boolean, canWrite: boolean): void;
}

export interface LoadLyraWasmModuleOptions {
  locateFile?: (path: string, prefix: string) => string;
  preRun?: (wasmModule: LyraWasmModule) => void;
}

export interface AudioData {
  set(index: number, value: number): void;
  get(index: number): number;
  length: number;
  delete(): void;
}

export interface Bytes {
  set(index: number, value: number): void;
  push_back(value: number): void;
  clear(): void;
  get(index: number): number;
  length: number;
  delete(): void;
}

export default function loadLyraWasmModule(options?: LoadLyraWasmModuleOptions): Promise<LyraWasmModule>;
