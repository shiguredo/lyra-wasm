import loadLyraWasmModule from "./lyra_wasm.js";
import * as lyra_wasm from "./lyra_wasm.js";

import {
  LYRA_VERSION,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_BITRATE,
  DEFAULT_ENABLE_DTX,
  DEFAULT_CHANNELS,
  LyraDecoderOptions,
  LyraEncoderOptions,
  trimLastSlash,
  checkSampleRate,
  checkNumberOfChannels,
  checkBitrate,
} from "./utils";

const MEMFS_MODEL_PATH = "/tmp/";
const FRAME_DURATION_MS = 20;

/**
 * Lyra 用の WebAssembly ファイルやモデルファイルを管理するためのクラス
 */
class LyraSyncModule {
  private wasmModule: lyra_wasm.LyraWasmModule;

  private constructor(wasmModule: lyra_wasm.LyraWasmModule) {
    this.wasmModule = wasmModule;
  }

  /**
   * Lyra の WebAssembly ファイルやモデルファイルをロードして {@link LyraSyncModule} のインスタンスを生成する
   *
   * @param wasmPath lyra.wasm および lyra.worker.js が配置されているディレクトリのパスないし URL
   * @param modelPath Lyra 用の *.binarypb および *.tflite が配置されているディレクトリのパスないし URL
   * @returns 生成された {@link LyraSyncModule} インスタンス
   */
  static async load(wasmPath: string, modelPath: string): Promise<LyraSyncModule> {
    const wasmModule = await loadLyraWasmModule({
      locateFile: (path) => {
        return trimLastSlash(wasmPath) + "/" + path;
      },
      preRun: (wasmModule) => {
        const fileNames = ["lyra_config.binarypb", "soundstream_encoder.tflite", "quantizer.tflite", "lyragan.tflite"];
        for (const fileName of fileNames) {
          const url = trimLastSlash(modelPath) + "/" + fileName;

          // FIXME(sile): url からのダウンロードに失敗しても catch ができないので fetch で置き換える
          wasmModule.FS_createPreloadedFile(MEMFS_MODEL_PATH, fileName, url, true, false);
        }
      },
    });

    return new LyraSyncModule(wasmModule);
  }

  /**
   * {@link LyraSyncEncoder} のインスタンスを生成する
   *
   * 生成したインスタンスが不要になったら {@link LyraSyncEncoder.destroy} メソッドを呼び出してリソースを解放すること
   *
   * @params options エンコーダに指定するオプション
   * @returns 生成された {@link LyraSyncEncoder} インスタンス
   */
  createEncoder(options: LyraEncoderOptions = {}): LyraSyncEncoder {
    checkSampleRate(options.sampleRate);
    checkNumberOfChannels(options.numberOfChannels);
    checkBitrate(options.bitrate);

    const encoder = this.wasmModule.LyraEncoder.create(
      options.sampleRate || DEFAULT_SAMPLE_RATE,
      options.numberOfChannels || DEFAULT_CHANNELS,
      options.bitrate || DEFAULT_BITRATE,
      options.enableDtx || DEFAULT_ENABLE_DTX,
      MEMFS_MODEL_PATH
    );
    if (encoder === undefined) {
      throw new Error("failed to create lyra encoder");
    } else {
      const frameSize = ((options.sampleRate || DEFAULT_SAMPLE_RATE) * FRAME_DURATION_MS) / 1000;
      const buffer = this.wasmModule.newAudioData(frameSize);
      return new LyraSyncEncoder(this.wasmModule, encoder, buffer, options);
    }
  }

  /**
   * {@link LyraSyncDecoder} のインスタンスを生成する
   *
   * 生成したインスタンスが不要になったら {@link LyraSyncDecoder.destroy} メソッドを呼び出してリソースを解放すること
   *
   * @params options デコーダに指定するオプション
   * @returns 生成された {@link LyraSyncDecoder} インスタンス
   */
  createDecoder(options: LyraDecoderOptions = {}): LyraSyncDecoder {
    checkSampleRate(options.sampleRate);
    checkNumberOfChannels(options.numberOfChannels);

    const decoder = this.wasmModule.LyraDecoder.create(
      options.sampleRate || DEFAULT_SAMPLE_RATE,
      options.numberOfChannels || DEFAULT_CHANNELS,
      MEMFS_MODEL_PATH
    );
    if (decoder === undefined) {
      throw new Error("failed to create lyra decoder");
    } else {
      const buffer = this.wasmModule.newBytes();
      return new LyraSyncDecoder(this.wasmModule, decoder, buffer, options);
    }
  }
}

/**
 * Lyra のエンコーダ
 */
class LyraSyncEncoder {
  private wasmModule: lyra_wasm.LyraWasmModule;
  private encoder: lyra_wasm.LyraWasmEncoder;
  private buffer: lyra_wasm.AudioData;

  /**
   * 現在のサンププリングレート
   */
  readonly sampleRate: number;

  /**
   * 現在のチャネル数
   */
  readonly numberOfChannels: number;

  /**
   * 現在のエンコードビットレート
   */
  readonly bitrate: number;

  /**
   * DTX が有効になっているかどうか
   */
  readonly enableDtx: boolean;

  /**
   * 一つのフレーム（{@link LyraSyncEncoder.encode} メソッドに渡す音声データ）に含めるサンプル数
   */
  readonly frameSize: number;

  /**
   * @internal
   */
  constructor(
    wasmModule: lyra_wasm.LyraWasmModule,
    encoder: lyra_wasm.LyraWasmEncoder,
    buffer: lyra_wasm.AudioData,
    options: LyraEncoderOptions
  ) {
    this.wasmModule = wasmModule;
    this.encoder = encoder;
    this.buffer = buffer;

    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
    this.bitrate = options.bitrate || DEFAULT_BITRATE;
    this.enableDtx = options.enableDtx || DEFAULT_ENABLE_DTX;
    this.frameSize = buffer.size();
  }

  /**
   * 20ms 分の音声データをエンコードする
   *
   * @params audioData エンコード対象の音声データ
   * @returns エンコード後のバイト列。もし DTX が有効で音声データが無音な場合には undefined が代わりに返される。
   *
   * @throws
   *
   * 以下のいずれかに該当する場合には例外が送出される:
   * - 入力音声データが 20ms 単位（サンプル数としては {@link LyraSyncEncoder.frameSize}）ではない
   * - その他、何らかの理由でエンコードに失敗した場合
   */
  encode(audioData: Int16Array): Uint8Array | undefined {
    if (audioData.length !== this.frameSize) {
      throw new Error(
        `expected an audio data with ${this.frameSize} samples, but got one with ${audioData.length} samples`
      );
    }

    this.wasmModule.copyInt16ArrayToAudioData(this.buffer, audioData);

    const result = this.encoder.encode(this.buffer);

    if (result === undefined) {
      throw new Error("failed to encode");
    } else {
      try {
        const encodedAudioData = new Uint8Array(result.size());
        for (let i = 0; i < encodedAudioData.length; i++) {
          encodedAudioData[i] = result.get(i);
        }

        if (encodedAudioData.length === 0) {
          // DTX が有効、かつ、 audioData が無音ないしノイズだけを含んでいる場合にはここに来る
          return undefined;
        }
        return encodedAudioData;
      } finally {
        result.delete();
      }
    }
  }

  /**
   * エンコードビットレートを変更する
   *
   * @params bitrate 変更後のビットレート
   */
  setBitrate(bitrate: number): void {
    checkBitrate(bitrate);

    if (!this.encoder.setBitrate(bitrate)) {
      throw new Error(`failed to update bitrate from ${this.bitrate} to ${bitrate}`);
    }
  }

  /**
   * エンコーダ用に確保したリソースを解放する
   */
  destroy(): void {
    this.encoder.delete();
    this.buffer.delete();
  }
}

/**
 * Lyra のデコーダ
 */
class LyraSyncDecoder {
  private wasmModule: lyra_wasm.LyraWasmModule;
  private decoder: lyra_wasm.LyraWasmDecoder;
  private buffer: lyra_wasm.Bytes;

  /**
   * 現在のサンププリングレート
   */
  readonly sampleRate: number;

  /**
   * 現在のチャネル数
   */
  readonly numberOfChannels: number;

  /**
   * 一つのフレーム（{@link LyraSyncEncoder.decode} メソッドの返り値の音声データ）に含まれるサンプル数
   */
  readonly frameSize: number;

  /**
   * @internal
   */
  constructor(
    wasmModule: lyra_wasm.LyraWasmModule,
    decoder: lyra_wasm.LyraWasmDecoder,
    buffer: lyra_wasm.Bytes,
    options: LyraDecoderOptions
  ) {
    this.wasmModule = wasmModule;
    this.decoder = decoder;
    this.buffer = buffer;

    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;

    this.frameSize = (this.sampleRate * FRAME_DURATION_MS) / 1000;
  }

  /**
   * {@link LyraSyncEncoder.encode} メソッドによってエンコードされた音声データをデコードする
   *
   * @params encodedAudioData デコード対象のバイナリ列ないし undefined
   * @returns デコードされた 20ms 分の音声データ。undefined が渡された場合には代わりにコンフォートノイズが生成される。
   */
  decode(encodedAudioData: Uint8Array | undefined): Int16Array {
    if (encodedAudioData !== undefined) {
      this.buffer.resize(0, 0); // clear() を使うと「関数が存在しない」というエラーが出るので resize() で代用
      for (const v of encodedAudioData) {
        this.buffer.push_back(v);
      }
      if (!this.decoder.setEncodedPacket(this.buffer)) {
        throw new Error("failed to set encoded packet");
      }
    }

    const result = this.decoder.decodeSamples(this.frameSize);

    if (result === undefined) {
      throw Error("failed to decode samples");
    }
    try {
      const audioData = new Int16Array(this.frameSize);
      this.wasmModule.copyAudioDataToInt16Array(audioData, result);
      return audioData;
    } finally {
      result.delete();
    }
  }

  /**
   * デコーダ用に確保したリソースを解放する
   */
  destroy(): void {
    this.decoder.delete();
    this.buffer.delete();
  }
}

export { LyraSyncModule, LyraSyncDecoder, LyraSyncEncoder, LyraEncoderOptions, LyraDecoderOptions, LYRA_VERSION };
