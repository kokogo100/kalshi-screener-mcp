// One small JSON document holds screens saved through MCP and the latest extension sync.
export const EMPTY = { savedScreens: {}, extension: null };

export function createMemoryStore(initial = EMPTY) {
  let state = structuredClone(initial);
  return storeFrom(async () => state, async (next) => { state = next; });
}

export function createKvStore(kv, key = "state") {
  return storeFrom(async () => ({ ...EMPTY, ...((await kv.get(key, "json")) || {}) }), (next) => kv.put(key, JSON.stringify(next)));
}

export function storeFrom(read, write) {
  let queue = Promise.resolve();
  const update = (change) => (queue = queue.then(async () => {
    const next = change(await read());
    await write(next);
    return next;
  }));
  return {
    read,
    saveScreen: (name, screen) => update((state) => ({ ...state, savedScreens: { ...state.savedScreens, [name]: { ...screen, savedAt: new Date().toISOString() } } })),
    deleteScreen: (name) => update((state) => {
      const savedScreens = { ...state.savedScreens };
      delete savedScreens[name];
      return { ...state, savedScreens };
    }),
    setExtension: (extension) => update((state) => ({ ...state, extension: { ...extension, syncedAt: new Date().toISOString() } }))
  };
}
