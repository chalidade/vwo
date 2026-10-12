/** Run `fn` over the items `size` at a time, each batch finishing before the next starts. */
export async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  const n = Math.max(1, Math.floor(size));
  for (let i = 0; i < items.length; i += n) await Promise.all(items.slice(i, i + n).map(fn));
}
