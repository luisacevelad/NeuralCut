/**
 * Ambient augmentation for Bun's jest-compatible mocking.
 *
 * bun:test exports `jest` as a namespace with fn/restoreAllMocks/etc.
 * but omits jest.mock() from the types even though it works at runtime.
 * This module augmentation bridges the gap.
 */
declare module "bun:test" {
	namespace jest {
		function mock(
			moduleName: string,
			factory: () => Record<string, unknown>,
		): void;
	}
}
