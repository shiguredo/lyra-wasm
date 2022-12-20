import { LyraModule, LyraDecoder, LyraEncoder } from "./lyra";

let LYRA_MODULE: LyraModule | undefined;
let LYRA_ENCODER: LyraEncoder | undefined;
let LYRA_DECODER: LyraDecoder | undefined;

async function loadLyraModule(wasmPath: string, modelPath: string): Promise<void> {
  LYRA_MODULE = await LyraModule.load(wasmPath, modelPath);
}

self.onmessage = async function handleMessageFromMain(msg) {
  //console.log(msg);
  switch (msg.data.type) {
    case "load":
      await loadLyraModule(msg.data.wasmPath, msg.data.modelPath);
      self.postMessage({ type: "loadDone" });
      break;
    case "createEncoder":
      // @ts-ignore
      LYRA_ENCODER = LYRA_MODULE.createEncoder(msg.data.options);
      self.postMessage({}); // TODO
      break;
    case "encode":
      // @ts-ignore
      const encoded = LYRA_ENCODER.encode(msg.data.audioData);
      self.postMessage({ encoded });
      break;
    case "createDecoder":
      // @ts-ignore
      LYRA_DECODER = LYRA_MODULE.createDecoder(msg.data.options);
      self.postMessage({}); // TODO
      break;
    case "encode":
      // @ts-ignore
      const decoded = LYRA_DECODER.encode(msg.data.audioData);
      self.postMessage({ decoded });
      break;
  }
};
