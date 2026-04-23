import { create } from "zustand";

type RightPanelTab = "properties" | "chat";

interface RightPanelState {
	activeTab: RightPanelTab;
	setActiveTab: (tab: RightPanelTab) => void;
}

export const useRightPanelStore = create<RightPanelState>()((set) => ({
	activeTab: "properties",
	setActiveTab: (tab) => set({ activeTab: tab }),
}));
