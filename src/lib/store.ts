"use client";
import { create } from "zustand";
import type { Bucket } from "./types";
type State = {
  bucket: Bucket | null;
  pending: number;
  setBucket: (b: Bucket | null, force?: boolean) => void;
  optimistic: (
    menuItemId: string,
    participantId: string,
    delta: number,
    remove?: boolean,
    price?: number,
  ) => void;
  finish: () => void;
};
export const useBucket = create<State>((set) => ({
  bucket: null,
  pending: 0,
  setBucket: (bucket, force = false) =>
    set((state) => (state.pending && !force ? {} : { bucket })),
  optimistic: (menuItemId, participantId, delta, remove, price = 0) =>
    set((state) => {
      if (!state.bucket) return {};
      const existing = state.bucket.items.find(
        (i) =>
          i.menuItemId === menuItemId &&
          i.participantId === participantId &&
          !i.batchId,
      );
      const quantity = remove
        ? 0
        : Math.max(0, (existing?.quantity ?? 0) + delta);
      return {
        pending: state.pending + 1,
        bucket: {
          ...state.bucket,
          items: [
            ...state.bucket.items.filter((i) => i !== existing),
            ...(quantity
              ? [
                  {
                    id:
                      existing?.id ??
                      `optimistic-${participantId}-${menuItemId}`,
                    menuItemId,
                    participantId,
                    batchId: null,
                    quantity,
                    unitPrice: existing?.unitPrice ?? price,
                  },
                ]
              : []),
          ],
        },
      };
    }),
  finish: () => set((state) => ({ pending: Math.max(0, state.pending - 1) })),
}));
