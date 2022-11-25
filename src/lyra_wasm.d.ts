export interface LyraWasmEncoderClass {
  create(
    sampleRate: number,
    numberOfChannels: number,
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
  create(sampleRate: number, numberOfChannels: number, modelPath: string): LyraWasmDecoder | undefined;
}

export interface LyraWasmDecoder {
  setEncodedPacket(encodedAudioData: Bytes): boolean;
  decodeSamples(numberOfSamples: number): AudioData | undefined;
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
  locateFile?: (path: string) => string;
  preRun?: (wasmModule: LyraWasmModule) => void;
}

export interface AudioData {
  set(index: number, value: number): void;
  get(index: number): number;
  size(): number;
  delete(): void;
}

export interface Bytes {
  clear(): void;
  push_back(value: number): void;
  get(index: number): number;
  size(): number;
  delete(): void;
}

export default function loadLyraWasmModule(options?: LoadLyraWasmModuleOptions): Promise<LyraWasmModule>;
