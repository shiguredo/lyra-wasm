import { LyraDecoder, LyraEncoder, LyraEncoderOptions, LyraModule } from "./lyra";
import { DEFAULT_CHANNELS, DEFAULT_ENABLE_DTX, DEFAULT_SAMPLE_RATE, LyraDecoderOptions } from "./utils";

let LYRA_MODULE: LyraModule | undefined;

let LYRA_ENCODER_ID: number = 0;
const LYRA_ENCODER_POOL: Map<string, SharedLyraEncoder> = new Map();

class SharedLyraEncoder {
  encoder: LyraEncoder;
  ports: Map<number, MessagePort>;

  constructor(encoder: LyraEncoder) {
    this.encoder = encoder;
    this.ports = new Map();
  }

  static key(options: LyraEncoderOptions): string {
    // NOTE: ビットレートは動的に変更可能なのでキーには含めない
    const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    const numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
    const enableDtx = options.enableDtx || DEFAULT_ENABLE_DTX;
    return `${sampleRate}:${numberOfChannels}:${enableDtx}`;
  }
}

let LYRA_DECODER_ID: number = 0;
const LYRA_DECODER_POOL: Map<string, SharedLyraDecoder> = new Map();

class SharedLyraDecoder {
  decoder: LyraDecoder;
  ports: Map<number, MessagePort>;

  constructor(decoder: LyraDecoder) {
    this.decoder = decoder;
    this.ports = new Map();
  }

  static key(options: LyraDecoderOptions): string {
    const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    const numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
    return `${sampleRate}:${numberOfChannels}`;
  }
}

async function loadLyraModule(modelPath: string): Promise<void> {
  // モデルファイルは web worker ファイルと同じディレクトリに配置されている
  const wasmPath = "./";
  LYRA_MODULE = await LyraModule.load(wasmPath, modelPath);
}

function createLyraEncoder(options: LyraEncoderOptions, port: MessagePort): { encoderId: number; frameSize: number } {
  if (LYRA_MODULE === undefined) {
    throw new Error("LYRA_MODULE is undefined");
  }

  const key = SharedLyraEncoder.key(options);
  let sharedEncoder = LYRA_ENCODER_POOL.get(key);
  if (sharedEncoder === undefined) {
    sharedEncoder = new SharedLyraEncoder(LYRA_MODULE.createEncoder(options));
  }

  const encoderId = LYRA_ENCODER_ID++;
  sharedEncoder.ports.set(encoderId, port);

  return { encoderId, frameSize: sharedEncoder.encoder.frameSize };
}

function createLyraDecoder(options: LyraDecoderOptions, port: MessagePort): { decoderId: number; frameSize: number } {
  if (LYRA_MODULE === undefined) {
    throw new Error("LYRA_MODULE is undefined");
  }

  const key = SharedLyraDecoder.key(options);
  let sharedDecoder = LYRA_DECODER_POOL.get(key);
  if (sharedDecoder === undefined) {
    sharedDecoder = new SharedLyraDecoder(LYRA_MODULE.createDecoder(options));
  }

  const decoderId = LYRA_DECODER_ID++;
  sharedDecoder.ports.set(decoderId, port);

  return { decoderId, frameSize: sharedDecoder.decoder.frameSize };
}

type Message = { data: MessageData };

type MessageData =
  | { type: "LyraModule.load"; modelPath: string }
  | { type: "LyraModule.createEncoder"; options: LyraEncoderOptions; port: MessagePort }
  | { type: "LyraModule.createDecoder"; options: LyraDecoderOptions; port: MessagePort };

self.onmessage = async function handleMessage(msg: Message) {
  let port;
  switch (msg.data.type) {
    case "LyraModule.load":
      try {
        await loadLyraModule(msg.data.modelPath);
        self.postMessage({ type: `${msg.data.type}.result`, result: {} });
      } catch (error) {
        self.postMessage({ type: `${msg.data.type}.result`, result: { error } });
      }
      break;
    case "LyraModule.createEncoder":
      port = msg.data.port;
      try {
        const result = createLyraEncoder(msg.data.options, port);
        port.postMessage({ type: `${msg.data.type}.result`, result });
      } catch (error) {
        port.postMessage({ type: `${msg.data.type}.result`, result: { error } });
      }
      break;
    case "LyraModule.createDecoder":
      port = msg.data.port;
      try {
        const result = createLyraDecoder(msg.data.options, port);
        port.postMessage({ type: `${msg.data.type}.result`, result });
      } catch (error) {
        port.postMessage({ type: `${msg.data.type}.result`, result: { error } });
      }
      break;
    default:
      console.warn("received unknown message");
      console.warn(msg);
  }
};
