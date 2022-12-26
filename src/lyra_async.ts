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

class LyraAsyncModule {
  private worker: Worker;

  private constructor(worker: Worker) {
    this.worker = worker;
  }

  static load(wasmPath: string, modelPath: string): Promise<LyraAsyncModule> {
    const worker = new Worker(trimLastSlash(wasmPath) + "/lyra_async_worker.js", {
      type: "module",
      name: "lyra_async_worker",
    });

    // モデルは web worker の中でロードされることになるので、
    // modelPath を事前に絶対 URL に変換して曖昧性がなくなるようにしておく
    modelPath = new URL(modelPath, document.location.href).toString();

    const promise: Promise<LyraAsyncModule> = new Promise((resolve, reject) => {
      type Response = { data: { type: "LyraModule.load.result"; result: { error?: Error } } };
      worker.addEventListener(
        "message",
        (res: Response) => {
          const error = res.data.result.error;
          if (error === undefined) {
            resolve(new LyraAsyncModule(worker));
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

  createEncoder(options: LyraEncoderOptions = {}): Promise<LyraAsyncEncoder> {
    const channel = new MessageChannel();

    const promise: Promise<LyraAsyncEncoder> = new Promise((resolve, reject) => {
      type Response = {
        data: {
          type: "LyraModule.createEncoder.result";
          result: { frameSize: number } | { error: Error };
        };
      };
      channel.port1.start();
      channel.port1.addEventListener(
        "message",
        (res: Response) => {
          const result = res.data.result;
          if ("error" in result) {
            reject(result.error);
          } else {
            resolve(new LyraAsyncEncoder(channel.port1, result.frameSize, options));
          }
        },
        { once: true }
      );
    });

    this.worker.postMessage({ type: "LyraModule.createEncoder", port: channel.port2, options }, [channel.port2]);
    return promise;
  }

  createDecoder(options: LyraDecoderOptions = {}): Promise<LyraAsyncDecoder> {
    const channel = new MessageChannel();

    const promise: Promise<LyraAsyncDecoder> = new Promise((resolve, reject) => {
      type Response = {
        data: {
          type: "LyraModule.createDecoder.result";
          result: { frameSize: number } | { error: Error };
        };
      };
      channel.port1.start();
      channel.port1.addEventListener(
        "message",
        (res: Response) => {
          const result = res.data.result;
          if ("error" in result) {
            reject(result.error);
          } else {
            resolve(new LyraAsyncDecoder(channel.port1, result.frameSize, options));
          }
        },
        { once: true }
      );
    });

    this.worker.postMessage({ type: "LyraModule.createDecoder", port: channel.port2, options }, [channel.port2]);
    return promise;
  }
}

class LyraAsyncEncoder {
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
  // encode(audioData: Int16Array): Promise<Uint8Array | undefined> {
  //   const promise: Promise<LyraAsyncEncoder> = new Promise((resolve, reject) => {
  //     type Response = {
  //       data: {
  //         type: "LyraEncoder.encode.result";
  //         result: { encoderId: number; frameSize: number } | { error: Error };
  //       };
  //     };
  //     channel.port1.start();
  //     channel.port1.addEventListener(
  //       "message",
  //       (res: Response) => {
  //         const result = res.data.result;
  //         if ("error" in result) {
  //           reject(result.error);
  //         } else {
  //           resolve(new LyraAsyncEncoder(channel.port1, result.encoderId, result.frameSize, options));
  //         }
  //       },
  //       { once: true }
  //     );
  //   });

  //   this.port.postMessage({ type: "LyraEncoder.encode", encoderId: this.encoderId, audioData }, [audioData.buffer]);
  //   return promise;
  // }

  // destroy(): void {
  //   this.port.postMessage({ type: "LyraEncoder.destroy", encoderId: this.encoderId });
  //   this.port.close();
  // }
}

class LyraAsyncDecoder {
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

  // decode(encodedAudioData: Uint8Array | undefined): Promise<Int16Array> {
  //   if (encodedAudioData === undefined) {
  //     this.port.postMessage({ type: "LyraDecoder.decode", encodedAudioData });
  //   } else {
  //     this.port.postMessage({ type: "LyraDecoder.decode", encodedAudioData }, [encodedAudioData.buffer]);
  //   }
  //   return new Promise((resolve) => {
  //     // TODO: once
  //     this.port.onmessage = function (msg) {
  //       // TODO: handle error result
  //       resolve(msg.data.decoded);
  //     };
  //   });
  // }

  // destroy(): void {
  //   this.port.postMessage({ type: "LyraDecoder.destroy", decoderId: this.decoderId });
  //   this.port.close();
  // }
}

export { LYRA_VERSION, LyraDecoderOptions, LyraEncoderOptions, LyraAsyncModule, LyraAsyncEncoder, LyraAsyncDecoder };
