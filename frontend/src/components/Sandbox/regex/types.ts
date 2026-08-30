export interface RegexMatch {
  text: string;
  start: number;
  end: number;
  groups: (string | undefined)[];
}

export interface CheatEntry {
  token: string;
  description: string;
  example: string;
  category: "character" | "quantifier" | "anchor" | "group" | "escape" | "flag";
}

export interface RegexPreset {
  name: string;
  pattern: string;
  flags: string;
  description: string;
  testString: string;
}

export interface RegexFlags {
  g: boolean;
  i: boolean;
  m: boolean;
  s: boolean;
}

export type GroupHighlight = {
  start: number;
  end: number;
  groupIndex: number;
  color: string;
};
