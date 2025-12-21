// Mock IndexedDB storage for testing
export class IndexedDBStorage {
  private store: any[] = []

  constructor(public dbName: string, public storeName: string) {}

  async add(value: any): Promise<void> {
    this.store.push(value)
  }

  async getAll(): Promise<any[]> {
    return [...this.store]
  }

  async clear(): Promise<void> {
    this.store = []
  }

  async close(): Promise<void> {
    // No-op for mock
  }
}
