import {
  LYRA_VERSION,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_BITRATE,
  DEFAULT_ENABLE_DTX,
  DEFAULT_CHANNELS,
  LyraDecoderOptions,
  LyraEncoderOptions,
  SampleRate,
  NumberOfChannels,
  Bitrate,
} from "./utils";

const WEB_WORKER_SCRIPT = "__WEB_WORKER_SCRIPT__";

/**
 * Lyra 用の WebAssembly ファイルやモデルファイルのロードや web worker の管理を行うためのクラス
 */
class LyraModule {
  private worker: Worker;

  private constructor(worker: Worker) {
    this.worker = worker;
  }

  /**
   * Lyra の WebAssembly ファイルやモデルファイルをロードや web worker の起動を行い、 {@link LyraModule} のインスタンスを生成する
   *
   * @param wasmPath lyra.wasm および lyra.worker.js が配置されているディレクトリのパスないし URL
   * @param modelPath Lyra 用の *.binarypb および *.tflite が配置されているディレクトリのパスないし URL
   * @returns 生成された {@link LyraModule} インスタンス
   */
  static load(wasmPath: string, modelPath: string): Promise<LyraModule> {
    // lyra は SharedArrayBufffer を使うので COEP / COOP 応答ヘッダ周りの対処が必要になるが、
    // chrome / firefox と safari で挙動が異なる（前者は COEP / COOP ヘッダが必要で、後者はそれがあるとエラーになる）ので
    // その問題を回避するために object url で worker を生成するようにする
    const webWorkerScriptObjectUrl = URL.createObjectURL(
      new Blob([atob(WEB_WORKER_SCRIPT)], { type: "application/javascript" })
    );
    const worker = new Worker(webWorkerScriptObjectUrl, {
      name: "lyra_sync_worker",
    });

    // 各種ファイルは web worker の中でロードされることになるので、
    // 事前に絶対 URL に変換しておく必要がある
    const wasmUrl = new URL(wasmPath, document.location.href).toString();
    const modelUrl = new URL(modelPath, document.location.href).toString();

    const promise: Promise<LyraModule> = new Promise((resolve, reject) => {
      type Response = {
        data: { type: "LyraModule.load.result"; result: { error?: Error } };
      };
      worker.addEventListener(
        "message",
        (res: Response) => {
          const error = res.data.result.error;
          if (error === undefined) {
            resolve(new LyraModule(worker));
          } else {
            reject(error);
          }
        },
        { once: true }
      );
    });

    worker.postMessage({ type: "LyraModule.load", modelUrl, wasmUrl });
    return promise;
  }

  /**
   * {@link LyraEncoder} のインスタンスを生成する
   *
   * 生成したインスタンスが不要になったら {@link LyraEncoder.destroy} メソッドを呼び出してリソースを解放すること
   *
   * なお、同じオプションで複数回 {@link createEncoder} メソッドが呼び出された場合には、
   * 内部的には（wasm レベルでは）同じエンコーダインスタンスが共有して使い回されることになり、
   * エンコーダ用に確保された wasm メモリ領域は、生成された全ての {@link LyraEncoder} が
   * {@link LyraEncoder.destroy} を呼び出すまでは解放されない
   *
   * @params options エンコーダに指定するオプション
   * @returns 生成された {@link LyraEncoder} インスタンス
   */
  createEncoder(options: LyraEncoderOptions = {}): Promise<LyraEncoder> {
    const channel = new MessageChannel();

    const promise: Promise<LyraEncoder> = new Promise((resolve, reject) => {
      type Response = {
        data: {
          type: "LyraModule.createEncoder.result";
          result: { frameSize: number } | { error: Error };
        };
      };
      channel.port1.addEventListener(
        "message",
        (res: Response) => {
          const result = res.data.result;
          if ("error" in result) {
            reject(result.error);
          } else {
            resolve(new LyraEncoder(channel.port1, result.frameSize, options));
          }
        },
        { once: true }
      );
      channel.port1.start();
    });

    this.worker.postMessage(
      { type: "LyraModule.createEncoder", port: channel.port2, options },
      [channel.port2]
    );
    return promise;
  }

  /**
   * {@link LyraDecoder} のインスタンスを生成する
   *
   * 生成したインスタンスが不要になったら {@link LyraDecoder.destroy} メソッドを呼び出してリソースを解放すること
   *
   * なお、同じオプションで複数回 {@link createDecoder} メソッドが呼び出された場合には、
   * 内部的には（wasm レベルでは）同じデコーダインスタンスが共有して使い回されることになり、
   * エンコーダ用に確保された wasm メモリ領域は、生成された全ての {@link LyraDecoder} が
   * {@link LyraDecoder.destroy} を呼び出すまでは解放されない
   *
   * @params options デコーダに指定するオプション
   * @returns 生成された {@link LyraDecoder} インスタンス
   */
  createDecoder(options: LyraDecoderOptions = {}): Promise<LyraDecoder> {
    const channel = new MessageChannel();

    const promise: Promise<LyraDecoder> = new Promise((resolve, reject) => {
      type Response = {
        data: {
          type: "LyraModule.createDecoder.result";
          result: { frameSize: number } | { error: Error };
        };
      };
      channel.port1.addEventListener(
        "message",
        (res: Response) => {
          const result = res.data.result;
          if ("error" in result) {
            reject(result.error);
          } else {
            resolve(new LyraDecoder(channel.port1, result.frameSize, options));
          }
        },
        { once: true }
      );
      channel.port1.start();
    });

    this.worker.postMessage(
      { type: "LyraModule.createDecoder", port: channel.port2, options },
      [channel.port2]
    );
    return promise;
  }
}

/**
 * {@link LyraEncoder} の復元に必要な状態
 *
 * 詳細は {@link LyraEncoder.fromState()} を参照
 */
interface LyraEncoderState {
  port: MessagePort;
  sampleRate: SampleRate;
  numberOfChannels: NumberOfChannels;
  bitrate: Bitrate;
  enableDtx: boolean;
  frameSize: number;
}

/**
 * {@link LyraDecoder} の復元に必要な状態
 *
 * 詳細は {@link LyraDecoder.fromState()} を参照
 */
interface LyraDecoderState {
  port: MessagePort;
  sampleRate: SampleRate;
  numberOfChannels: NumberOfChannels;
  frameSize: number;
}

/**
 * Lyra のエンコーダ
 */
class LyraEncoder {
  /**
   * wasm でのエンコード処理を実行する web worker と通信するためのポート
   */
  readonly port: MessagePort;

  /**
   * 現在のサンププリングレート
   */
  readonly sampleRate: SampleRate;

  /**
   * 現在のチャネル数
   */
  readonly numberOfChannels: NumberOfChannels;

  /**
   * 現在のエンコードビットレート
   */
  readonly bitrate: Bitrate;

  /**
   * DTX が有効になっているかどうか
   */
  readonly enableDtx: boolean;

  /**
   * 一つのフレーム（{@link LyraEncoder.encode} メソッドに渡す音声データ）に含めるサンプル数
   */
  readonly frameSize: number;

  /**
   * @internal
   */
  constructor(
    port: MessagePort,
    frameSize: number,
    options: LyraEncoderOptions
  ) {
    this.port = port;
    this.frameSize = frameSize;
    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
    this.bitrate = options.bitrate || DEFAULT_BITRATE;
    this.enableDtx = options.enableDtx || DEFAULT_ENABLE_DTX;
  }

  /**
   * 20ms 分の音声データをエンコードする
   *
   * なお audioData の所有権は web worker に移転されるので、
   * このメソッド呼び出し後には呼び出しもとスレッドからはデータに参照できなくなります
   * （つまり同じ audioData インスタンスの使い回しはできない）
   *
   * @params audioData エンコード対象の音声データ
   * @returns エンコード後のバイト列。もし DTX が有効で音声データが無音な場合には undefined が代わりに返される。
   *
   * @throws
   *
   * 以下のいずれかに該当する場合には例外が送出される:
   * - 入力音声データが 20ms 単位（サンプル数としては {@link LyraEncoder.frameSize}）ではない
   * - その他、何らかの理由でエンコードに失敗した場合
   */
  encode(audioData: Int16Array): Promise<Uint8Array | undefined> {
    const promise: Promise<Uint8Array | undefined> = new Promise(
      (resolve, reject) => {
        type Response = {
          data: {
            type: "LyraEncoder.encode.result";
            result:
              | { encodedAudioData: Uint8Array | undefined }
              | { error: Error };
          };
        };
        this.port.addEventListener(
          "message",
          (res: Response) => {
            const result = res.data.result;
            if ("error" in result) {
              reject(result.error);
            } else {
              resolve(result.encodedAudioData);
            }
          },
          { once: true }
        );
      }
    );

    this.port.postMessage({ type: "LyraEncoder.encode", audioData }, [
      audioData.buffer,
    ]);
    return promise;
  }

  /**
   * エンコーダ用に確保したリソースを解放する
   */
  destroy(): void {
    this.port.postMessage({ type: "LyraEncoder.destroy" });
    this.port.close();
  }

  /**
   * {@link LyraEncoderState} から {@link LyraEncoder} を復元する
   *
   * {@link LyraEncoder} は {@link MessagePort.postMessage()} を使って、
   * 別の web worker に転送することが可能。
   * ただし、転送時にはクラスやメソッドの状態は落ちてしまうので、
   * それを復元して再び利用可能にするための関数。
   * なお、転送の際には {@link LyraEncoder.port} の所有権を移譲する必要がある。
   *
   * @param state エンコーダの状態
   * @return 復元されたエンコーダ
   */
  static fromState(state: LyraEncoderState): LyraEncoder {
    state.port.start();
    return new LyraEncoder(state.port, state.frameSize, state);
  }
}

/**
 * Lyra のデコーダ
 */
class LyraDecoder {
  /**
   * wasm でのデコード処理を実行する web worker と通信するためのポート
   */
  readonly port: MessagePort;

  /**
   * 現在のサンププリングレート
   */
  readonly sampleRate: SampleRate;

  /**
   * 現在のチャネル数
   */
  readonly numberOfChannels: NumberOfChannels;

  /**
   * 一つのフレーム（{@link LyraEncoder.decode} メソッドの返り値の音声データ）に含まれるサンプル数
   */
  readonly frameSize: number;

  /**
   * @internal
   */
  constructor(
    port: MessagePort,
    frameSize: number,
    options: LyraDecoderOptions
  ) {
    this.port = port;
    this.frameSize = frameSize;
    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
  }

  /**
   * {@link LyraEncoder.encode} メソッドによってエンコードされた音声データをデコードする
   *
   * なお encodedAudioData の所有権は web worker に移転されるので、
   * このメソッド呼び出し後には呼び出しもとスレッドからはデータに参照できなくなります
   * （つまり同じ encodedAudioData インスタンスの使い回しはできない）
   *
   * @params encodedAudioData デコード対象のバイナリ列ないし undefined
   * @returns デコードされた 20ms 分の音声データ。undefined が渡された場合には代わりにコンフォートノイズが生成される。
   */
  decode(encodedAudioData: Uint8Array | undefined): Promise<Int16Array> {
    const promise: Promise<Int16Array> = new Promise((resolve, reject) => {
      type Response = {
        data: {
          type: "LyraDecoder.decode.result";
          result: { audioData: Int16Array } | { error: Error };
        };
      };
      this.port.addEventListener(
        "message",
        (res: Response) => {
          const result = res.data.result;
          if ("error" in result) {
            reject(result.error);
          } else {
            resolve(result.audioData);
          }
        },
        { once: true }
      );
    });

    if (encodedAudioData === undefined) {
      this.port.postMessage({ type: "LyraDecoder.decode", encodedAudioData });
    } else {
      this.port.postMessage({ type: "LyraDecoder.decode", encodedAudioData }, [
        encodedAudioData.buffer,
      ]);
    }
    return promise;
  }

  /**
   * デコーダ用に確保したリソースを解放する
   */
  destroy(): void {
    this.port.postMessage({ type: "LyraDecoder.destroy" });
    this.port.close();
  }

  /**
   * {@link LyraDecoderState} から {@link LyraDecoder} を復元する
   *
   * {@link LyraDecoder} は {@link MessagePort.postMessage()} を使って、
   * 別の web worker に転送することが可能。
   * ただし、転送時にはクラスやメソッドの状態は落ちてしまうので、
   * それを復元して再び利用可能にするための関数。
   * なお、転送の際には {@link LyraDecoder.port} の所有権を移譲する必要がある。
   *
   * @param state デコーダの状態
   * @return 復元されたデコーダ
   */
  static fromState(state: LyraDecoderState): LyraDecoder {
    state.port.start();
    return new LyraDecoder(state.port, state.frameSize, state);
  }
}

export {
  LYRA_VERSION,
  LyraDecoderOptions,
  LyraEncoderOptions,
  LyraModule,
  LyraEncoder,
  LyraDecoder,
  LyraEncoderState,
  LyraDecoderState,
  SampleRate,
  NumberOfChannels,
  Bitrate,
};
