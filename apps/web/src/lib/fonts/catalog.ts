/**
 * Curated font catalog for agent discovery.
 *
 * System fonts are always available. Google Fonts are a curated subset of the
 * most useful/popular fonts from the full atlas (~1 500+ families).
 * The full atlas is loaded on-demand by the FontPicker UI; this catalog gives
 * the agent enough variety for creative decisions without inflating context.
 */

export const SYSTEM_FONT_LIST = [
	"Arial",
	"Helvetica",
	"Times New Roman",
	"Courier New",
	"Verdana",
	"Georgia",
	"monospace",
	"sans-serif",
	"serif",
] as const;

export const GOOGLE_FONT_CATALOG = [
	// Sans-serif — versatile body & UI text
	"Roboto",
	"Open Sans",
	"Lato",
	"Montserrat",
	"Poppins",
	"Raleway",
	"Nunito",
	"Ubuntu",
	"Work Sans",
	"DM Sans",
	"Inter",
	"Manrope",
	"Plus Jakarta Sans",
	"Space Grotesk",
	"Noto Sans",
	"Rubik",
	"Quicksand",
	// Serif — editorial, formal, elegant
	"Playfair Display",
	"Merriweather",
	"Lora",
	"Noto Serif",
	"Crimson Text",
	"Bitter",
	"EB Garamond",
	"Libre Baskerville",
	// Display / Headings — bold impact
	"Bebas Neue",
	"Oswald",
	"Anton",
	"Righteous",
	"Abril Fatface",
	"Barlow Condensed",
	"Roboto Condensed",
	"Stretch Pro",
	// Script / Handwriting — casual, creative
	"Lobster",
	"Pacifico",
	"Dancing Script",
	"Great Vibes",
	"Satisfy",
	"Caveat",
	"Permanent Marker",
	// Monospace — code, technical
	"Fira Code",
	"JetBrains Mono",
	"Source Code Pro",
	"IBM Plex Mono",
] as const;

/** All available font names (system first, then curated Google fonts), sorted. */
export const ALL_FONT_NAMES: readonly string[] = [
	...SYSTEM_FONT_LIST,
	...GOOGLE_FONT_CATALOG,
];
