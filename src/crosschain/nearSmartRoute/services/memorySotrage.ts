class MemoryStorage {
  private storage = new Map<string, string>();

  getItem(key: string): string | undefined {
    return this.storage.get(key);
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }
}

export const memoryStorage = new MemoryStorage();
