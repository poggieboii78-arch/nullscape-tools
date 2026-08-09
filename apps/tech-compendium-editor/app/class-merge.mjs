// @ts-check

/**
 * Merge class-sized updates without treating an absent local class as a deletion.
 * Existing classes keep their shared position, new classes append, and an explicit
 * class order is only applied when the editor says the order itself changed.
 *
 * @template {{ id: string }} T
 * @param {T[]} current
 * @param {T[]} incoming
 * @param {string[] | undefined} classOrder
 * @param {string[]} [blockedIds]
 * @returns {T[]}
 */
export function mergeClasses(current, incoming, classOrder, blockedIds = []) {
  const blocked = new Set(blockedIds);
  const incomingById = new Map();
  for (const item of incoming) {
    if (!blocked.has(item.id)) incomingById.set(item.id, item);
  }

  const merged = current
    .filter((item) => !blocked.has(item.id))
    .map((item) => incomingById.get(item.id) ?? item);
  const existingIds = new Set(merged.map((item) => item.id));
  for (const item of incomingById.values()) {
    if (!existingIds.has(item.id)) {
      merged.push(item);
      existingIds.add(item.id);
    }
  }

  if (!classOrder) return merged;
  const byId = new Map(merged.map((item) => [item.id, item]));
  const ordered = [];
  for (const id of classOrder) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      byId.delete(id);
    }
  }
  for (const item of merged) {
    if (byId.delete(item.id)) ordered.push(item);
  }
  return ordered;
}

/**
 * Keep only class updates that are at least as new as the shared copy. This
 * prevents an earlier request that lost a Git conflict from winning on retry.
 *
 * @template {{ id: string, updatedAt?: string }} T
 * @param {T[]} current
 * @param {T[]} incoming
 * @returns {T[]}
 */
export function newestClasses(current, incoming) {
  const sharedById = new Map(current.map((item) => [item.id, item]));
  return incoming.filter((item) => {
    const shared = sharedById.get(item.id);
    if (!shared?.updatedAt) return true;
    const incomingTime = Date.parse(item.updatedAt ?? "");
    const sharedTime = Date.parse(shared.updatedAt);
    return Number.isFinite(incomingTime) && (!Number.isFinite(sharedTime) || incomingTime >= sharedTime);
  });
}
