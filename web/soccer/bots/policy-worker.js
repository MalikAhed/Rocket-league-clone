import * as ort from '../../vendor/ort/ort.wasm.min.mjs';

// A dedicated worker keeps policy inference out of the render/physics loop.
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('../../vendor/ort/', import.meta.url).href;
const sessions = new Map();
let queue = Promise.resolve();

async function run(session, inputs, names) {
  const feeds = Object.fromEntries(Object.entries(inputs).map(([name, value]) =>
    [name, new ort.Tensor('float32', value.data, value.dims)]));
  let result;
  try {
    result = await session.run(feeds, names);
    return Object.fromEntries(Object.entries(result).map(([name, tensor]) => [name, tensor.data.slice()]));
  } finally {
    for (const tensor of Object.values(feeds)) tensor.dispose();
    for (const tensor of Object.values(result ?? {})) tensor.dispose();
  }
}

async function handle(data) {
  const {id, kind, botId, inputs, outputNames} = data;
  try {
    if (kind === 'load') {
      if (!sessions.has(botId)) {
        const response = await fetch(data.url);
        if (!response.ok) throw Error(`Unable to load ${botId}: HTTP ${response.status}`);
        const session = await ort.InferenceSession.create(await response.arrayBuffer(), {executionProviders:['wasm']});
        try { await run(session, inputs, outputNames); }
        catch (error) { await session.release(); throw error; }
        sessions.set(botId, session);
      }
      self.postMessage({id, kind:'loaded'});
    } else if (kind === 'decide') {
      const session = sessions.get(botId);
      if (!session) throw Error(`${botId} has not loaded`);
      const outputs = await run(session, inputs, outputNames);
      self.postMessage({id, kind:'decision', outputs}, Object.values(outputs).map(value => value.buffer));
    } else throw Error('Unknown policy request');
  } catch (error) {
    self.postMessage({id, kind:'error', error:error.message ?? String(error)});
  }
}
self.onmessage = ({data}) => { queue = queue.then(() => handle(data)); };
