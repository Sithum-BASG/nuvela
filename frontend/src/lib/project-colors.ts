// The eight project color swatches, sourced verbatim from the Figma Color
// Selector (file Ff1qt7PSxze0Y5I49xfy70, node 329:672) via the Figma MCP.
// The backend stores `color` as a free string (hex or token) — we persist the
// hex so the board/card swatch renders identically without a token lookup.
// These are content colors (a per-project label), not theme tokens, so a fixed
// hex is correct here and stays stable across light/dark.
export type ProjectColor = {
  name: string;
  value: string;
};

export const PROJECT_COLORS: ProjectColor[] = [
  { name: "Violet", value: "#7c74d6" },
  { name: "Blue", value: "#6687e8" },
  { name: "Green", value: "#2f855a" },
  { name: "Amber", value: "#b7791f" },
  { name: "Pink", value: "#c26aa0" },
  { name: "Teal", value: "#4ba7a0" },
  { name: "Purple", value: "#5a52b5" },
  { name: "Red", value: "#c53030" },
];

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0].value;
