import { config } from './config.js';

const ordersByUser = new Map();
const externalIndex = new Map();

const CLEANUP_INTERVAL = Math.max(30_000, Math.floor(config.store.orderTtlMs / 2));

function pruneExpired() {
  const now = Date.now();
  const expiry = now - config.store.orderTtlMs;

  const expired = [];
  for (const [userId, order] of ordersByUser.entries()) {
    if (order.updatedAt < expiry) {
      expired.push(userId);
    }
  }

  expired.forEach((userId) => {
    clearUserOrder(userId);
  });

  if (ordersByUser.size > config.store.maxEntries) {
    const sorted = Array.from(ordersByUser.entries()).sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    const overflow = sorted.length - config.store.maxEntries;
    for (let i = 0; i < overflow; i += 1) {
      const [userId] = sorted[i];
      clearUserOrder(userId);
    }
  }
}

setInterval(pruneExpired, CLEANUP_INTERVAL).unref();

export function setUserOrder(userId, order) {
  const existing = ordersByUser.get(userId) || {};
  const nextExternalIds = new Set(existing.externalIds || []);
  if (order.externalIds) {
    order.externalIds.forEach((id) => {
      if (id) nextExternalIds.add(id);
    });
  }

  const next = {
    ...existing,
    ...order,
    externalIds: Array.from(nextExternalIds),
    updatedAt: Date.now(),
  };

  ordersByUser.set(userId, next);
  next.externalIds.forEach((id) => {
    if (id) {
      externalIndex.set(id, userId);
    }
  });

  return next;
}

export function linkUserOrder(userId, externalId) {
  if (!externalId) return;
  const order = ordersByUser.get(userId);
  if (!order) return;

  if (!order.externalIds.includes(externalId)) {
    order.externalIds.push(externalId);
  }
  externalIndex.set(externalId, userId);
}

export function getUserOrder(userId) {
  return ordersByUser.get(userId) || null;
}

export function getOrderByExternalId(externalId) {
  const userId = externalIndex.get(externalId);
  if (!userId) return null;
  return { userId, order: ordersByUser.get(userId) || null };
}

export function updateUserOrder(userId, patch) {
  const current = ordersByUser.get(userId);
  if (!current) return null;

  const next = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };

  ordersByUser.set(userId, next);
  return next;
}

export function clearUserOrder(userId) {
  const order = ordersByUser.get(userId);
  if (order?.externalIds) {
    order.externalIds.forEach((id) => {
      externalIndex.delete(id);
    });
  }
  ordersByUser.delete(userId);
}

