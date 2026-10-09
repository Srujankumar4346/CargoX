export interface QueuedOperation {
  id: string;
  type: 'LOCATION_UPDATE' | 'TRIP_STEP' | 'POD_UPLOAD';
  endpoint: string;
  method: 'POST' | 'PUT';
  payload: any;
  createdAt: number;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
}

class OfflineQueueService {
  private memoryQueue: QueuedOperation[] = [];

  async getQueue(): Promise<QueuedOperation[]> {
    try {
      const SecureStore = require("expo-secure-store");
      const data = await SecureStore.getItemAsync("cargox_offline_queue");
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }
    return this.memoryQueue;
  }

  async saveQueue(queue: QueuedOperation[]): Promise<void> {
    this.memoryQueue = queue;
    try {
      const SecureStore = require("expo-secure-store");
      await SecureStore.setItemAsync("cargox_offline_queue", JSON.stringify(queue));
    } catch {
      // fallback
    }
  }

  async enqueue(op: Omit<QueuedOperation, 'id' | 'createdAt' | 'retryCount' | 'status'>): Promise<QueuedOperation> {
    const queue = await this.getQueue();
    const newOp: QueuedOperation = {
      ...op,
      id: 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      createdAt: Date.now(),
      retryCount: 0,
      status: 'PENDING'
    };
    queue.push(newOp);
    await this.saveQueue(queue);
    return newOp;
  }

  async processSync(apiCallFn: (endpoint: string, options: any) => Promise<any>): Promise<{ synced: number; failed: number }> {
    const queue = await this.getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let syncedCount = 0;
    let failedCount = 0;
    const remainingQueue: QueuedOperation[] = [];

    for (const op of queue) {
      try {
        await apiCallFn(op.endpoint, {
          method: op.method,
          body: JSON.stringify(op.payload)
        });
        syncedCount++;
      } catch (err: any) {
        op.retryCount += 1;
        if (op.retryCount < 5) {
          remainingQueue.push(op);
        }
        failedCount++;
      }
    }

    await this.saveQueue(remainingQueue);
    return { synced: syncedCount, failed: failedCount };
  }
}

export const offlineQueue = new OfflineQueueService();
