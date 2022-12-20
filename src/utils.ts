/**
 * Lyra のエンコード形式のバージョン。
 *
 * エンコード形式に非互換な変更が入った時点での google/lyra のバージョンが格納されている。
 */
const LYRA_VERSION = "1.3.0";

const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_BITRATE = 9200;
const DEFAULT_ENABLE_DTX = false;
const DEFAULT_CHANNELS = 1;

/**
 * {@link LyraModule.createEncoder} メソッドに指定可能なオプション
 */
interface LyraEncoderOptions {
  /**
   * 入力音声データのサンプルレート
   *
   * なお 16000 以外のサンプルレートが指定された場合には、内部的にはリサンプルが行われる。
   *
   * デフォルト値: 16000
   */
  sampleRate?: 8000 | 16000 | 32000 | 48000;

  /**
   * 入力音声データのチャンネル数
   *
   * 現在は 1 (モノラル）のみが指定可能
   */
  numberOfChannels?: 1;

  /**
   * エンコード後の音声データのビットレート
   *
   * デフォルト値: 9200
   */
  bitrate?: 3200 | 6000 | 9200;

  /**
   * DTX（discontinuous transmission）を有効にするかどうか
   *
   * デフォルト値: false
   */
  enableDtx?: boolean;
}

/**
 * {@link LyraModule.createDecoder} メソッドに指定可能なオプション
 */
interface LyraDecoderOptions {
  /**
   * 入力音声データのサンプルレート
   *
   * デフォルト値: 16000
   */
  sampleRate?: 8000 | 16000 | 32000 | 48000;

  /**
   * 入力音声データのチャンネル数
   *
   * 現在は 1 (モノラル）のみが指定可能
   */
  numberOfChannels?: 1;
}

function trimLastSlash(s: string): string {
  if (s.slice(-1) === "/") {
    return s.slice(0, -1);
  }
  return s;
}

function checkSampleRate(n: number | undefined): void {
  switch (n) {
    case undefined:
    case 8000:
    case 16000:
    case 32000:
    case 48000:
      return;
  }
  throw new Error(`unsupported sample rate: expected one of 8000, 16000, 32000 or 48000, but got ${n}`);
}

function checkNumberOfChannels(n: number | undefined): void {
  switch (n) {
    case undefined:
    case 1:
      return;
  }
  throw new Error(`unsupported number of channels: expected 1, but got ${n}`);
}

function checkBitrate(n: number | undefined): void {
  switch (n) {
    case undefined:
    case 3200:
    case 6000:
    case 9200:
      return;
  }
  throw new Error(`unsupported bitrate: expected one of 3200, 6000 or 9200, but got ${n}`);
}

export {
  LYRA_VERSION,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_BITRATE,
  DEFAULT_ENABLE_DTX,
  DEFAULT_CHANNELS,
  LyraEncoderOptions,
  LyraDecoderOptions,
  trimLastSlash,
  checkSampleRate,
  checkNumberOfChannels,
  checkBitrate,
};
