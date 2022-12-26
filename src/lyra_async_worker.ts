import { LyraEncoder, LyraEncoderOptions, LyraModule } from "./lyra";
import { DEFAULT_CHANNELS, DEFAULT_ENABLE_DTX, DEFAULT_SAMPLE_RATE } from "./utils";

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
    const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
    const numberOfChannels = options.numberOfChannels || DEFAULT_CHANNELS;
    const enableDtx = options.enableDtx || DEFAULT_ENABLE_DTX;
    return `${sampleRate}:${numberOfChannels}:${enableDtx}`;
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

// case "createEncoder":
//   // @ts-ignore
//   const encoder = LYRA_MODULE.createEncoder(msg.data.options);
//   const port = msg.data.port;
//   self.postMessage({}); // TODO

//   // @ts-ignore
//   port.onmessage = function (e) {
//     if (e.data.type !== "encode") {
//       console.log(e);
//       return;
//     }
//     const encoded = encoder.encode(e.data.audioData);
//     port.postMessage({ encoded });
//   };
//   // @ts-ignore
//   port.onmessageerror = function (e) {
//     console.log("error");
//     console.log(e);
//   };
//   break;

type Message = { data: MessageData };

type MessageData =
  | { type: "LyraModule.load"; modelPath: string }
  | { type: "LyraModule.createEncoder"; options: LyraEncoderOptions; port: MessagePort };

self.onmessage = async function handleMessage(msg: Message) {
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
      const port = msg.data.port;
      try {
        const result = createLyraEncoder(msg.data.options, port);
        port.postMessage({ type: `${msg.data.type}.result`, result });
      } catch (error) {
        port.postMessage({ type: `${msg.data.type}.result`, result: { error } });
      }
      break;
    // // case "encode":
    // //   // @ts-ignore
    // //   const encoded = LYRA_ENCODER.encode(msg.data.audioData);
    // //   self.postMessage({ encoded });
    // //   break;
    // case "createDecoder":
    //   // @ts-ignore
    //   LYRA_DECODER = LYRA_MODULE.createDecoder(msg.data.options);
    //   self.postMessage({}); // TODO
    //   break;
    // case "encode":
    //   // @ts-ignore
    //   const decoded = LYRA_DECODER.encode(msg.data.audioData);
    //   self.postMessage({ decoded });
    //   break;
    default:
      console.warn("received unknown message");
      console.warn(msg);
  }
};
