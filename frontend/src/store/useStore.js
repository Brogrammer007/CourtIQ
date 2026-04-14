import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      favorites: [], // array of player IDs
      compareSlots: [null, null], // [playerIdA, playerIdB]

      toggleFavorite: (id) => {
        const cur = get().favorites;
        set({
          favorites: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        });
      },
      isFavorite: (id) => get().favorites.includes(id),

      setCompareSlot: (index, id) => {
        const next = [...get().compareSlots];
        next[index] = id;
        set({ compareSlots: next });
      },
      clearCompare: () => set({ compareSlots: [null, null] }),
    }),
    { name: 'courtiq-state' }
  )
);
