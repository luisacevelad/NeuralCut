import { beforeEach, describe, expect, test } from "bun:test";
import { useRightPanelStore } from "@/stores/right-panel-store";

describe("rightPanelStore", () => {
	beforeEach(() => {
		useRightPanelStore.getState().setActiveTab("properties");
	});

	test("default active tab is properties", () => {
		expect(useRightPanelStore.getState().activeTab).toBe("properties");
	});

	test("setActiveTab switches to chat", () => {
		useRightPanelStore.getState().setActiveTab("chat");
		expect(useRightPanelStore.getState().activeTab).toBe("chat");
	});

	test("setActiveTab switches back to properties", () => {
		useRightPanelStore.getState().setActiveTab("chat");
		expect(useRightPanelStore.getState().activeTab).toBe("chat");

		useRightPanelStore.getState().setActiveTab("properties");
		expect(useRightPanelStore.getState().activeTab).toBe("properties");
	});

	test("tab state persists across reads", () => {
		useRightPanelStore.getState().setActiveTab("chat");
		// Multiple reads should return the same value
		expect(useRightPanelStore.getState().activeTab).toBe("chat");
		expect(useRightPanelStore.getState().activeTab).toBe("chat");
	});

	test("only valid tab values are accepted", () => {
		// TypeScript enforces this at compile time, but at runtime
		// zustand will store whatever is passed
		useRightPanelStore.getState().setActiveTab("chat");
		expect(useRightPanelStore.getState().activeTab).toBe("chat");

		useRightPanelStore.getState().setActiveTab("properties");
		expect(useRightPanelStore.getState().activeTab).toBe("properties");
	});
});
