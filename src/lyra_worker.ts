import { LyraModule, LyraDecoder } from "./lyra";

let LYRA_MODULE: LyraModule | undefined;
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
      const encoder = LYRA_MODULE.createEncoder(msg.data.options);
      const port = msg.data.port;
      self.postMessage({}); // TODO

      // @ts-ignore
      port.onmessage = function (e) {
        if (e.data.type !== "encode") {
          console.log(e);
          return;
        }
        const encoded = encoder.encode(e.data.audioData);
        port.postMessage({ encoded });
      };
      // @ts-ignore
      port.onmessageerror = function (e) {
        console.log("error");
        console.log(e);
      };
      break;
    // case "encode":
    //   // @ts-ignore
    //   const encoded = LYRA_ENCODER.encode(msg.data.audioData);
    //   self.postMessage({ encoded });
    //   break;
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
