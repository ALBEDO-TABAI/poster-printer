// Utility process for the AI cut-out (spawned by main.cjs with utilityProcess.fork). Keeps onnxruntime and the
// model out of the main process; main kills it with SIGKILL when idle or on quit, so onnxruntime's static teardown
// (which can abort with "recursive_mutex lock failed") never runs and macOS never reports a crash.
'use strict';
const { cutout } = require('./cutout.cjs');

process.parentPort.on('message', async ({ data: msg }) => {
  try {
    const png = await cutout(msg.model, Buffer.from(msg.image));
    process.parentPort.postMessage({ id: msg.id, png: new Uint8Array(png.buffer, png.byteOffset, png.length) });
  } catch (e) {
    process.parentPort.postMessage({ id: msg.id, error: String((e && e.message) || e) });
  }
});
