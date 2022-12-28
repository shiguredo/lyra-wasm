import { LyraSyncDecoder, LyraSyncEncoder, LyraEncoderOptions, LyraSyncModule } from "./lyra_sync";
import { LyraDecoderOptions } from "./utils";

// エンコーダとデコーダのインスタンスの合計数の最大値
//
// この値を変更する場合には wasm/BUILD にある `-s INITIAL_MEMORY` の値も合わせて変更すること
const MAX_RESOURCES = 10;

let RESOURCE_MANAGER: ResourceManager | undefined;

class ResourceManager {
  lyraModule: LyraSyncModule;
  encoders: Map<MessagePort, Resource<LyraSyncEncoder>> = new Map();
  decoders: Map<MessagePort, Resource<LyraSyncDecoder>> = new Map();

  constructor(lyraModule: LyraSyncModule) {
    this.lyraModule = lyraModule;
  }

  createEncoder(port: MessagePort, options: LyraEncoderOptions): LyraSyncEncoder {
    this.evictIfNeed();
    const encoder = this.lyraModule.createEncoder(options);
    this.encoders.set(port, new Resource(encoder));
    return encoder;
  }

  createDecoder(port: MessagePort, options: LyraDecoderOptions): LyraSyncDecoder {
    this.evictIfNeed();
    const decoder = this.lyraModule.createDecoder(options);
    this.decoders.set(port, new Resource(decoder));
    return decoder;
  }

  getEncoder(port: MessagePort, options: LyraEncoderOptions): LyraSyncEncoder {
    const encoder = this.encoders.get(port);
    if (encoder !== undefined) {
      encoder.lastAccessedTime = performance.now();
      return encoder.item;
    } else {
      return this.createEncoder(port, options);
    }
  }

  getDecoder(port: MessagePort, options: LyraDecoderOptions): LyraSyncDecoder {
    const decoder = this.decoders.get(port);
    if (decoder !== undefined) {
      decoder.lastAccessedTime = performance.now();
      return decoder.item;
    } else {
      return this.createDecoder(port, options);
    }
  }

  remove(port: MessagePort): void {
    this.encoders.delete(port);
    this.decoders.delete(port);
  }

  evictIfNeed(): void {
    if (this.encoders.size + this.decoders.size < MAX_RESOURCES) {
      return;
    }

    // インスタンス数の上限に達している場合には、使用された時刻が一番古いものを削除する
    let oldestPort;
    let oldestTime;
    for (const [port, resource] of this.encoders.entries()) {
      if (oldestTime === undefined || resource.lastAccessedTime < oldestTime) {
        oldestPort = port;
        oldestTime = resource.lastAccessedTime;
      }
    }
    for (const [port, resource] of this.decoders.entries()) {
      if (oldestTime === undefined || resource.lastAccessedTime < oldestTime) {
        oldestPort = port;
        oldestTime = resource.lastAccessedTime;
      }
    }
    if (oldestPort !== undefined) {
      this.remove(oldestPort);
    }
  }
}

class Resource<T> {
  item: T;
  lastAccessedTime: number;

  constructor(item: T) {
    this.item = item;
    this.lastAccessedTime = performance.now();
  }
}

async function initResourceManager(wasmPath: string, modelPath: string): Promise<void> {
  RESOURCE_MANAGER = new ResourceManager(await LyraSyncModule.load(wasmPath, modelPath));
}

type ModuleMessage = { data: ModuleMessageData };

type ModuleMessageData =
  | { type: "LyraModule.load"; modelPath: string; wasmPath: string }
  | { type: "LyraModule.createEncoder"; options: LyraEncoderOptions; port: MessagePort }
  | { type: "LyraModule.createDecoder"; options: LyraDecoderOptions; port: MessagePort };

self.onmessage = async function handleModuleMessage(msg: ModuleMessage) {
  switch (msg.data.type) {
    case "LyraModule.load":
      try {
        await initResourceManager(msg.data.wasmPath, msg.data.modelPath);
        self.postMessage({ type: `${msg.data.type}.result`, result: {} });
      } catch (error) {
        self.postMessage({ type: `${msg.data.type}.result`, result: { error } });
      }
      break;
    case "LyraModule.createEncoder":
      {
        const port = msg.data.port;
        try {
          const manager = RESOURCE_MANAGER;
          if (manager === undefined) {
            throw new Error("RESOURCE_MANAGER is undefined");
          }
          const options = msg.data.options;
          const encoder = manager.createEncoder(port, options);
          port.onmessage = (msg) => {
            handleEncoderMessage(manager, port, options, msg);
          };
          port.postMessage({ type: `${msg.data.type}.result`, result: { frameSize: encoder.frameSize } });
        } catch (error) {
          port.postMessage({ type: `${msg.data.type}.result`, result: { error } });
        }
      }
      break;
    case "LyraModule.createDecoder":
      {
        const port = msg.data.port;
        try {
          const manager = RESOURCE_MANAGER;
          if (manager === undefined) {
            throw new Error("RESOURCE_MANAGER is undefined");
          }
          const options = msg.data.options;
          const decoder = manager.createDecoder(port, options);
          port.onmessage = (msg) => {
            handleDecoderMessage(manager, port, options, msg);
          };
          port.postMessage({ type: `${msg.data.type}.result`, result: { frameSize: decoder.frameSize } });
        } catch (error) {
          port.postMessage({ type: `${msg.data.type}.result`, result: { error } });
        }
      }
      break;
    default:
      console.warn("received unknown message");
      console.warn(msg);
  }
};

type EncoderMessage = { data: EncoderMessageData };

type EncoderMessageData =
  | { type: "LyraEncoder.encode"; audioData: Int16Array; bitrate: 3200 | 6000 | 9200 }
  | { type: "LyraEncoder.destroy" };

function handleEncoderMessage(
  manager: ResourceManager,
  port: MessagePort,
  options: LyraEncoderOptions,
  msg: EncoderMessage
): void {
  switch (msg.data.type) {
    case "LyraEncoder.encode":
      try {
        const encoder = manager.getEncoder(port, options);
        const encodedAudioData = encoder.encode(msg.data.audioData);
        const response = { type: `${msg.data.type}.result`, result: { encodedAudioData } };
        if (encodedAudioData === undefined) {
          port.postMessage(response);
        } else {
          port.postMessage(response, [encodedAudioData.buffer]);
        }
      } catch (error) {
        port.postMessage({ type: `${msg.data.type}.result`, result: { error } });
      }
      break;
    case "LyraEncoder.destroy":
      manager.remove(port);
      port.onmessage = null;
      break;
    default:
      console.warn("received unknown message");
      console.warn(msg);
  }
}

type DecoderMessage = { data: DecoderMessageData };

type DecoderMessageData =
  | { type: "LyraDecoder.decode"; encodedAudioData: Uint8Array | undefined }
  | { type: "LyraDecoder.destroy" };

function handleDecoderMessage(
  manager: ResourceManager,
  port: MessagePort,
  options: LyraDecoderOptions,
  msg: DecoderMessage
): void {
  switch (msg.data.type) {
    case "LyraDecoder.decode":
      try {
        const decoder = manager.getDecoder(port, options);
        const audioData = decoder.decode(msg.data.encodedAudioData);
        port.postMessage({ type: `${msg.data.type}.result`, result: { audioData } }, [audioData.buffer]);
      } catch (error) {
        port.postMessage({ type: `${msg.data.type}.result`, result: { error } });
      }
      break;
    case "LyraDecoder.destroy":
      manager.remove(port);
      port.onmessage = null;
      break;
    default:
      console.warn("received unknown message");
      console.warn(msg);
  }
}
