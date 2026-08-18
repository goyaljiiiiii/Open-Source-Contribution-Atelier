import { describe, it, expect } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import notificationReducer, {
  setWsUnreadCount,
  addNotification,
  markReadLocally,
  markAllReadLocally,
  AppNotification,
} from "../features/notifications/notificationSlice";

function createStore() {
  return configureStore({
    reducer: { notifications: notificationReducer },
  });
}

function makeNotification(
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id: 1,
    notif_type: "info",
    title: "Test",
    message: "Test message",
    is_read: false,
    created_at: new Date().toISOString(),
    meta: {},
    ...overrides,
  };
}

describe("notification badge count refresh via Redux slice", () => {
  it("setWsUnreadCount updates count from server polling", () => {
    const store = createStore();
    expect(store.getState().notifications.wsUnreadCount).toBe(0);

    // Simulate polling result updating unread count
    store.dispatch(setWsUnreadCount(5));
    expect(store.getState().notifications.wsUnreadCount).toBe(5);

    // Simulate another poll with different count
    store.dispatch(setWsUnreadCount(3));
    expect(store.getState().notifications.wsUnreadCount).toBe(3);
  });

  it("addNotification increments unread count", () => {
    const store = createStore();
    store.dispatch(setWsUnreadCount(2));

    store.dispatch(addNotification(makeNotification({ id: 10 })));
    expect(store.getState().notifications.wsUnreadCount).toBe(3);
  });

  it("markReadLocally decrements unread count", () => {
    const store = createStore();
    store.dispatch(setWsUnreadCount(5));
    store.dispatch(addNotification(makeNotification({ id: 20 })));
    // wsUnreadCount is now 6

    store.dispatch(markReadLocally(20));
    expect(store.getState().notifications.wsUnreadCount).toBe(5);
  });

  it("markReadLocally never goes below zero", () => {
    const store = createStore();
    store.dispatch(setWsUnreadCount(0));
    store.dispatch(markReadLocally(999));
    expect(store.getState().notifications.wsUnreadCount).toBe(0);
  });

  it("markAllReadLocally resets unread count to zero", () => {
    const store = createStore();
    store.dispatch(setWsUnreadCount(10));
    store.dispatch(addNotification(makeNotification({ id: 30 })));

    store.dispatch(markAllReadLocally());
    expect(store.getState().notifications.wsUnreadCount).toBe(0);
  });

  it("setWsUnreadCount overrides stale count from polling", () => {
    const store = createStore();

    // Simulate WS gave us count 3
    store.dispatch(setWsUnreadCount(3));
    // Simulate polling sees 7 unread on server
    store.dispatch(setWsUnreadCount(7));
    expect(store.getState().notifications.wsUnreadCount).toBe(7);
  });

  it("polling refresh reflects correct unread count after reads", () => {
    const store = createStore();
    store.dispatch(addNotification(makeNotification({ id: 1, is_read: false })));
    store.dispatch(addNotification(makeNotification({ id: 2, is_read: false })));
    // wsUnreadCount is 2

    store.dispatch(markReadLocally(1));
    // wsUnreadCount is 1

    // Polling re-syncs from server — say server says 1 unread
    store.dispatch(setWsUnreadCount(1));
    expect(store.getState().notifications.wsUnreadCount).toBe(1);
  });
});
