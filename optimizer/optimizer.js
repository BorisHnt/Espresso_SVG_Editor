let requestId = 0;
let worker;

const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker("./optimizer/worker.js", { type: "module" });
    worker.addEventListener("message", (event) => {
      const { id, optimized } = event.data;
      const resolver = pending.get(id);
      if (!resolver) {
        return;
      }
      pending.delete(id);
      resolver(optimized);
    });
  }
  return worker;
}

export function optimizeMarkup(markup) {
  const id = ++requestId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    getWorker().postMessage({ id, markup });
  });
}
