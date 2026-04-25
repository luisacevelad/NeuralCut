import { EditorCore } from "@/core";
import { Command, type CommandResult } from "@/lib/commands/base-command";
import type { SceneTracks } from "@/lib/timeline";
import { SplitElementsCommand } from "./split-elements";

export class SplitCommand extends Command {
	private savedState: SceneTracks | null = null;
	private affectedElements: string[] = [];

	constructor(private readonly times: number[]) {
		super();
	}

	getAffectedElements(): string[] {
		return this.affectedElements;
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		this.savedState = editor.scenes.getActiveScene().tracks;
		const affectedElements = new Set<string>();
		let selectedRightSide: Array<{ trackId: string; elementId: string }> = [];

		for (const time of uniqueSortedTimes(this.times)) {
			const tracks = editor.scenes.getActiveScene().tracks;
			const targets = findElementsIntersectingTime({ tracks, time });
			for (const target of targets) {
				affectedElements.add(target.elementId);
			}

			const rightSide = executeSplit({ elements: targets, splitTime: time });
			if (rightSide.length > 0) {
				selectedRightSide = rightSide;
			}
			for (const target of rightSide) {
				affectedElements.add(target.elementId);
			}
		}

		this.affectedElements = [...affectedElements];
		return this.affectedElements.length > 0
			? { select: selectedRightSide }
			: undefined;
	}

	undo(): void {
		if (!this.savedState) {
			return;
		}

		EditorCore.getInstance().timeline.updateTracks(this.savedState);
	}
}

function uniqueSortedTimes(times: number[]): number[] {
	return [...new Set(times)].sort((a, b) => a - b);
}

function executeSplit({
	elements,
	splitTime,
}: {
	elements: Array<{ trackId: string; elementId: string }>;
	splitTime: number;
}): Array<{ trackId: string; elementId: string }> {
	if (elements.length === 0) {
		return [];
	}

	const command = new SplitElementsCommand({ elements, splitTime });
	command.execute();
	return command.getRightSideElements();
}

function findElementsIntersectingTime({
	tracks,
	time,
}: {
	tracks: SceneTracks;
	time: number;
}): Array<{ trackId: string; elementId: string }> {
	const result: Array<{ trackId: string; elementId: string }> = [];
	const allTracks = [tracks.main, ...tracks.overlay, ...tracks.audio];

	for (const track of allTracks) {
		for (const element of track.elements) {
			const elementStart = element.startTime;
			const elementEnd = element.startTime + element.duration;
			if (time > elementStart && time < elementEnd) {
				result.push({ trackId: track.id, elementId: element.id });
			}
		}
	}

	return result;
}
