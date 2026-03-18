import { create } from "zustand";

interface AeolusStore {
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;

  selectedFeature: string;
  setSelectedFeature: (feature: string) => void;

  labelFilter: "all" | "anomaly" | "normal";
  setLabelFilter: (filter: "all" | "anomaly" | "normal") => void;

  chatMessages: Array<{ role: "user" | "assistant"; content: string }>;
  addChatMessage: (msg: { role: "user" | "assistant"; content: string }) => void;
  clearChat: () => void;

  chatContext: Record<string, unknown>;
  setChatContext: (ctx: Record<string, unknown>) => void;
}

export const useAeolusStore = create<AeolusStore>((set) => ({
  selectedEventId: null,
  setSelectedEventId: (id) => set({ selectedEventId: id }),

  selectedFeature: "power_30_avg",
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),

  labelFilter: "all",
  setLabelFilter: (filter) => set({ labelFilter: filter }),

  chatMessages: [],
  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  clearChat: () => set({ chatMessages: [] }),

  chatContext: {},
  setChatContext: (ctx) => set({ chatContext: ctx }),
}));
