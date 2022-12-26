import { LyraDecoder, LyraEncoder, LyraEncoderOptions, LyraModule } from "./lyra";
import { DEFAULT_CHANNELS, DEFAULT_ENABLE_DTX, DEFAULT_SAMPLE_RATE, LyraDecoderOptions } from "./utils";

let LYRA_MODULE: LyraModule | undefined;
const LYRA_ENCODER_POOL: Map<string, WeakRef<LyraEncoder>> = new Map();
const LYRA_DECODER_POOL: Map<string, WeakRef<LyraDecoder>> = new Map();

function encoderPoolKey(options: LyraEncoderOptions): string {
  // NOTE: ビットレートは動的に変更可能なのでキーには含めない
  const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
  const numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
  const enableDtx = options.enableDtx || DEFAULT_ENABLE_DTX;
  return `${sampleRate}:${numberOfChannels}:${enableDtx ? 1 : 0}`;
}

function decoderPoolKey(options: LyraDecoderOptions): string {
  const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
  const numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
  return `${sampleRate}:${numberOfChannels}`;
}

async function loadLyraModule(modelPath: string): Promise<void> {
  // モデルファイルは web worker ファイルと同じディレクトリに配置されている
  const wasmPath = "./";
  LYRA_MODULE = await LyraModule.load(wasmPath, modelPath);
}

function createLyraEncoder(options: LyraEncoderOptions): LyraEncoder {
  if (LYRA_MODULE === undefined) {
    throw new Error("LYRA_MODULE is undefined");
  }

  const key = encoderPoolKey(options);

  let weakEncoder = LYRA_ENCODER_POOL.get(key);
  let encoder = weakEncoder && weakEncoder.deref();
  if (encoder !== undefined) {
    return encoder;
  }

  encoder = LYRA_MODULE.createEncoder(options);
  LYRA_ENCODER_POOL.set(key, new WeakRef(encoder));
  return encoder;
}

function createLyraDecoder(options: LyraDecoderOptions): LyraDecoder {
  if (LYRA_MODULE === undefined) {
    throw new Error("LYRA_MODULE is undefined");
  }

  const key = decoderPoolKey(options);

  let weakDecoder = LYRA_DECODER_POOL.get(key);
  let decoder = weakDecoder && weakDecoder.deref();
  if (decoder !== undefined) {
    return decoder;
  }

  decoder = LYRA_MODULE.createDecoder(options);
  LYRA_DECODER_POOL.set(key, new WeakRef(decoder));
  return decoder;
}

type ModuleMessage = { data: ModuleMessageData };

type ModuleMessageData =
  | { type: "LyraModule.load"; modelPath: string }
  | { type: "LyraModule.createEncoder"; options: LyraEncoderOptions; port: MessagePort }
  | { type: "LyraModule.createDecoder"; options: LyraDecoderOptions; port: MessagePort };

self.onmessage = async function handleModuleMessage(msg: ModuleMessage) {
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
        const encoder = createLyraEncoder(msg.data.options);
        //port.onmessage = handleEncoderMessage();
        port.postMessage({ type: `${msg.data.type}.result`, result: { frameSize: encoder.frameSize } });
      } catch (error) {
        port.postMessage({ type: `${msg.data.type}.result`, result: { error } });
      }
      break;
    case "LyraModule.createDecoder":
      port = msg.data.port;
      try {
        const decoder = createLyraDecoder(msg.data.options);
        port.postMessage({ type: `${msg.data.type}.result`, result: { frameSize: decoder.frameSize } });
      } catch (error) {
        port.postMessage({ type: `${msg.data.type}.result`, result: { error } });
      }
      break;
    default:
      console.warn("received unknown message");
      console.warn(msg);
  }
};
