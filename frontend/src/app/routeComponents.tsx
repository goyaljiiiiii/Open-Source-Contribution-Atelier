
export const RegexPlaygroundPage = lazy(() =>
  import("../pages/RegexPlaygroundPage").then((module) => ({
    default: module.RegexPlaygroundPage,
  })),
);
