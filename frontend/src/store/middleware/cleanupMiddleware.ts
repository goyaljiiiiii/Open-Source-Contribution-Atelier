import { Middleware } from "@reduxjs/toolkit";

export const cleanupMiddleware: Middleware = (store) => (next) => (action: any) => {
  if (action && action.type === "LOCATION_CHANGE") {
    // Disabled RESET_APP_STATE as it was wiping the entire Redux store on navigation.
    // store.dispatch({ type: "RESET_APP_STATE", payload: action.payload });
  }
  return next(action);
};
