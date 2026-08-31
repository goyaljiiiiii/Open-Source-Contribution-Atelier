export const RegexPlaygroundPage = lazy(() =>
  import("../pages/RegexPlaygroundPage").then((module) => ({
    default: module.RegexPlaygroundPage,
  })),
);

export const GitBranchSimulatorPage = lazy(() =>
  import("../pages/GitBranchSimulatorPage").then((module) => ({
    default: module.GitBranchSimulatorPage,
  })),
);

export const ColorPaletteGeneratorPage = lazy(() =>
  import("../pages/ColorPaletteGeneratorPage").then((module) => ({
    default: module.ColorPaletteGeneratorPage,
  })),
);
  })),
);
