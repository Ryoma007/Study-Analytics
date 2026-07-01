// Mock idb-keyval — jsdom 不支持 IndexedDB
const store = new Map<string, string>();

export const get = async (key: string): Promise<string | null> => {
  return store.get(key) ?? null;
};

export const set = async (key: string, value: string): Promise<void> => {
  store.set(key, value);
};

export const del = async (key: string): Promise<void> => {
  store.delete(key);
};

// 用于测试的辅助：清空 mock 存储
export const clearMockStore = () => {
  store.clear();
};
