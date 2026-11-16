/**
 * Oddiy jarayon ichidagi navbat: bir vaqtda `concurrency` ta vazifa ishlaydi.
 * Holat bazada (AiEvaluation.status) saqlanadi, shuning uchun server qayta ishga tushsa, vazifalar qayta navbatga qo'yiladi.
 * Bir nechta server nusxasi (cluster) ishlatilsa, BullMQ kabi tashqi navbatga o'tish kerak.
 */
export class AsyncQueue {
  private items: string[] = [];
  private queued = new Set<string>();
  private active = 0;

  constructor(
    private readonly concurrency: number,
    private readonly handler: (id: string) => Promise<void>,
  ) {}

  push(id: string) {
    if (this.queued.has(id)) return;
    this.queued.add(id);
    this.items.push(id);
    this.pump();
  }

  get size() {
    return this.items.length + this.active;
  }

  private pump() {
    while (this.active < this.concurrency && this.items.length > 0) {
      const id = this.items.shift() as string;
      this.active++;
      this.handler(id)
        .catch(() => undefined)
        .finally(() => {
          this.queued.delete(id);
          this.active--;
          this.pump();
        });
    }
  }
}
