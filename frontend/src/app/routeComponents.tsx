
export const ColorPaletteGeneratorPage = lazy(() =>
  import("../pages/ColorPaletteGeneratorPage").then((module) => ({
    default: module.ColorPaletteGeneratorPage,
  })),
);
