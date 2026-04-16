export class BoundedAsyncQueue<T> {
  private readonly items: T[] = [];
  private readonly takers: Array<(value: T | null) => void> = [];
  private readonly pushWaiters: Array<() => void> = [];
  private closed = false;

  constructor(public readonly highWaterMark: number) {}

  get size() {
    return this.items.length;
  }

  async push(value: T) {
    if (this.closed) {
      throw new Error('queue-closed');
    }

    if (this.takers.length > 0) {
      const taker = this.takers.shift()!;
      taker(value);
      return;
    }

    this.items.push(value);
    if (this.items.length > this.highWaterMark) {
      await new Promise<void>((resolve) => this.pushWaiters.push(resolve));
    }
  }

  async shift(): Promise<T | null> {
    if (this.items.length > 0) {
      const value = this.items.shift()!;
      if (this.pushWaiters.length > 0 && this.items.length <= this.highWaterMark) {
        this.pushWaiters.shift()!();
      }
      return value;
    }

    if (this.closed) {
      return null;
    }

    return await new Promise<T | null>((resolve) => this.takers.push(resolve));
  }

  close() {
    this.closed = true;
    while (this.takers.length > 0) {
      this.takers.shift()!(null);
    }
    while (this.pushWaiters.length > 0) {
      this.pushWaiters.shift()!();
    }
  }
}
