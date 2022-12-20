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
    worker.postMessage({ type: "LyraModule.load", wasmPath, modelPath });

    // TODO: handle error response
    return new Promise((resolve) => {
      worker.addEventListener("message", () => resolve(new LyraAsyncModule(worker)), { once: true });
    });
  }

  createEncoder(options: LyraEncoderOptions = {}): Promise<LyraAsyncEncoder> {
    checkSampleRate(options.sampleRate);
    checkNumberOfChannels(options.numberOfChannels);
    checkBitrate(options.bitrate);

    const channel = new MessageChannel();
    this.worker.postMessage({ type: "LyraModule.createEncoder", port: channel.port2, options }, [channel.port2]);

    return new Promise((resolve) => {
      channel.port1.addEventListener(
        "message",
        (msg) => {
          // TODO: handle error response
          resolve(new LyraAsyncEncoder(channel.port1, msg.data.frameSize, options));
        },
        { once: true }
      );
    });
  }

  createDecoder(options: LyraDecoderOptions = {}): Promise<LyraAsyncDecoder> {
    checkSampleRate(options.sampleRate);
    checkNumberOfChannels(options.numberOfChannels);

    const channel = new MessageChannel();
    this.worker.postMessage({ type: "LyraModule.createDecoder", port: channel.port2, options }, [channel.port2]);

    return new Promise((resolve) => {
      channel.port1.addEventListener(
        "message",
        (msg) => {
          // TODO: handle error response
          resolve(new LyraAsyncDecoder(channel.port1, msg.data.frameSize, options));
        },
        { once: true }
      );
    });
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

  encode(audioData: Int16Array): Promise<Uint8Array | undefined> {
    this.port.postMessage({ type: "LyraEncoder.encode", audioData }, [audioData.buffer]);
    return new Promise((resolve) => {
      // TODO: once
      this.port.onmessage = function (msg) {
        // TODO: handle error result
        resolve(msg.data.encoded);
      };
    });
  }

  // TODO: FinalizationRegistry
  destroy(): void {
    this.port.postMessage({ type: "LyraEncoder.destroy" });
    this.port.close();
  }
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

  decode(encodedAudioData: Uint8Array | undefined): Promise<Int16Array> {
    if (encodedAudioData === undefined) {
      this.port.postMessage({ type: "LyraDecoder.decode", encodedAudioData });
    } else {
      this.port.postMessage({ type: "LyraDecoder.decode", encodedAudioData }, [encodedAudioData.buffer]);
    }
    return new Promise((resolve) => {
      // TODO: once
      this.port.onmessage = function (msg) {
        // TODO: handle error result
        resolve(msg.data.decoded);
      };
    });
  }

  // TODO: FinalizationRegistry
  destroy(): void {
    this.port.postMessage({ type: "LyraDecoder.destroy" });
    this.port.close();
  }
}

export { LYRA_VERSION, LyraDecoderOptions, LyraEncoderOptions, LyraAsyncModule, LyraAsyncEncoder, LyraAsyncDecoder };
