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
  setBitrate(bitrate: number): boolean;
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
  newBytes(): Bytes;
  newAudioData(numberOfSamples: number): AudioData;
  copyAudioDataToInt16Array(to: Int16Array, from: AudioData): void;
  copyInt16ArrayToAudioData(to: AudioData, from: Int16Array): void;
  FS_createDataFile(
    parent: string,
    name: string,
    data: Uint8Array,
    canRead: boolean,
    canWrite: boolean,
    canOwn: boolean
  ): any;
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
  resize(size: number, default_value: number): void;
  push_back(value: number): void;
  get(index: number): number;
  size(): number;
  delete(): void;
}

export default function loadLyraWasmModule(options?: LoadLyraWasmModuleOptions): Promise<LyraWasmModule>;
