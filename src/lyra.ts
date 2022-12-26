import {
  LYRA_VERSION,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_BITRATE,
  DEFAULT_ENABLE_DTX,
  DEFAULT_CHANNELS,
  LyraDecoderOptions,
  LyraEncoderOptions,
  trimLastSlash,
} from "./utils";

class LyraModule {
  private worker: Worker;

  private constructor(worker: Worker) {
    this.worker = worker;
  }

  static load(wasmPath: string, modelPath: string): Promise<LyraModule> {
    const worker = new Worker(trimLastSlash(wasmPath) + "/lyra_sync_worker.js", {
      type: "module",
      name: "lyra_sync_worker",
    });

    // モデルは web worker の中でロードされることになるので、
    // modelPath を事前に絶対 URL に変換して曖昧性がなくなるようにしておく
    modelPath = new URL(modelPath, document.location.href).toString();

    const promise: Promise<LyraModule> = new Promise((resolve, reject) => {
      type Response = { data: { type: "LyraModule.load.result"; result: { error?: Error } } };
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

    worker.postMessage({ type: "LyraModule.load", modelPath });
    return promise;
  }

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

    this.worker.postMessage({ type: "LyraModule.createEncoder", port: channel.port2, options }, [channel.port2]);
    return promise;
  }

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

    this.worker.postMessage({ type: "LyraModule.createDecoder", port: channel.port2, options }, [channel.port2]);
    return promise;
  }
}

class LyraEncoder {
  readonly port: MessagePort;
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly bitrate: number;
  readonly enableDtx: boolean;
  readonly frameSize: number;

  constructor(port: MessagePort, frameSize: number, options: LyraEncoderOptions) {
    this.port = port;
    this.frameSize = frameSize;
    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
    this.bitrate = options.bitrate || DEFAULT_BITRATE;
    this.enableDtx = options.enableDtx || DEFAULT_ENABLE_DTX;
  }

  // TODO: audioData が transfer されることを書く
  encode(audioData: Int16Array): Promise<Uint8Array | undefined> {
    const promise: Promise<Uint8Array | undefined> = new Promise((resolve, reject) => {
      type Response = {
        data: {
          type: "LyraEncoder.encode.result";
          result: { encodedAudioData: Uint8Array | undefined } | { error: Error };
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
    });

    this.port.postMessage({ type: "LyraEncoder.encode", audioData, bitrate: this.bitrate }, [audioData.buffer]);
    return promise;
  }

  destroy(): void {
    this.port.postMessage({ type: "LyraEncoder.destroy" });
    this.port.close();
  }
}

class LyraDecoder {
  readonly port: MessagePort;
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly frameSize: number;

  constructor(port: MessagePort, frameSize: number, options: LyraDecoderOptions) {
    this.port = port;
    this.frameSize = frameSize;
    this.sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    this.numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
  }

  // TODO: encodedAudioData が transfer されることを書く
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
      this.port.postMessage({ type: "LyraDecoder.decode", encodedAudioData }, [encodedAudioData.buffer]);
    }
    return promise;
  }

  destroy(): void {
    this.port.postMessage({ type: "LyraDecoder.destroy" });
    this.port.close();
  }
}

export { LYRA_VERSION, LyraDecoderOptions, LyraEncoderOptions, LyraModule, LyraEncoder, LyraDecoder };
