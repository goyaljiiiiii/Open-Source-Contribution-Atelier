
export const JsonTreeViewerPage = lazy(() =>
  import("../pages/JsonTreeViewerPage").then((module) => ({
    default: module.JsonTreeViewerPage,
  })),
);
