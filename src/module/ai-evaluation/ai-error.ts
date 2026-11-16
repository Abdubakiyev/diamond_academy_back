/** AI / STT chaqiruvlaridagi xato. retryable = true bo'lsa, navbat avtomatik qayta urinadi. */
export class AiError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** fetch ni vaqt chegarasi bilan o'raydi */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new AiError(aborted ? 'So‘rov vaqti tugadi' : `Tarmoq xatosi: ${(e as Error).message}`, true);
  } finally {
    clearTimeout(timer);
  }
}
