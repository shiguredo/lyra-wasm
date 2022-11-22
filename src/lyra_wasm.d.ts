export interface LyraWasmModule extends EmscriptenModule {}

export interface LoadLyraWasmModuleOptions {
  locateFile?: (path: string, prefix: string) => string;
}

export default function loadLyraWasmModule(options?: LoadLyraWasmModuleOptions): Promise<LyraWasmModule>;
