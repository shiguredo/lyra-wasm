import { LyraModule } from "./lyra";

let LYRA_MODULE: LyraModule | undefined;

async function handleLyraModuleLoad(modelPath: string): Promise<void> {
  // モデルファイルは web worker ファイルと同じディレクトリに配置されている
  const wasmPath = "./";
  try {
    LYRA_MODULE = await LyraModule.load(wasmPath, modelPath);
    self.postMessage({ type: "LyraModule.load.result" });
  } catch (e) {
    self.postMessage({ type: "LyraModule.load.result", error: e });
  }
}

self.onmessage = async function handleMessage(msg) {
  switch (msg.data.type) {
    case "LyraModule.load":
      await handleLyraModuleLoad(msg.data.modelPath);
      break;
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
