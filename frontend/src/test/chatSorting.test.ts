import { describe, it, expect } from "vitest";
import {
  parseMessageTime,
  sortAndDeduplicateMessages,
  ChatMessage,
} from "../hooks/useChat";

describe("Chat Message Deduplication & Sorting", () => {
  it("parses valid ISO created_at timestamps into epoch milliseconds", () => {
    const msg: ChatMessage = {
      id: 1,
      username: "alice",
      user_id: 10,
      message: "Hello",
      timestamp: "10:00:00 AM",
      created_at: "2026-08-04T10:00:00.000Z",
    };
    expect(parseMessageTime(msg)).toBe(new Date("2026-08-04T10:00:00.000Z").getTime());
  });

  it("places optimistic messages at the end when sorting", () => {
    const msg: ChatMessage = {
      id: "msg_1_optimistic",
      username: "alice",
      user_id: 10,
      message: "Drafting message...",
      timestamp: "10:05:00 AM",
    };
    expect(parseMessageTime(msg)).toBe(Infinity);
  });

  it("stably sorts out-of-order messages by created_at timestamp ascending", () => {
    const msg1: ChatMessage = {
      id: 1,
      username: "alice",
      user_id: 10,
      message: "First message",
      timestamp: "10:00:00 AM",
      created_at: "2026-08-04T10:00:00.000Z",
    };
    const msg2: ChatMessage = {
      id: 2,
      username: "bob",
      user_id: 11,
      message: "Second message",
      timestamp: "10:01:00 AM",
      created_at: "2026-08-04T10:01:00.000Z",
    };
    const msg3: ChatMessage = {
      id: 3,
      username: "carol",
      user_id: 12,
      message: "Third message",
      timestamp: "10:02:00 AM",
      created_at: "2026-08-04T10:02:00.000Z",
    };

    // Passed out of order (WebSocket live message msg3 arrived before REST history msg1 and msg2)
    const raw = [msg3, msg1, msg2];
    const sorted = sortAndDeduplicateMessages(raw);

    expect(sorted.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("deduplicates messages arriving from REST and WebSocket with matching IDs", () => {
    const restMsg1: ChatMessage = {
      id: 101,
      username: "alice",
      user_id: 10,
      message: "Hello world",
      timestamp: "10:00:00 AM",
      created_at: "2026-08-04T10:00:00.000Z",
    };

    const wsMsg1: ChatMessage = {
      id: 101,
      username: "alice",
      user_id: 10,
      message: "Hello world",
      timestamp: "10:00:00 AM",
      created_at: "2026-08-04T10:00:00.000Z",
    };

    const wsMsg2: ChatMessage = {
      id: 102,
      username: "bob",
      user_id: 11,
      message: "Hey Alice!",
      timestamp: "10:00:05 AM",
      created_at: "2026-08-04T10:00:05.000Z",
    };

    const merged = sortAndDeduplicateMessages([restMsg1, wsMsg1, wsMsg2]);

    expect(merged.length).toBe(2);
    expect(merged.map((m) => m.id)).toEqual([101, 102]);
  });

  it("uses id as tie-breaker when created_at timestamps are identical", () => {
    const msgA: ChatMessage = {
      id: 5,
      username: "alice",
      user_id: 10,
      message: "Message 5",
      timestamp: "10:00:00 AM",
      created_at: "2026-08-04T10:00:00.000Z",
    };

    const msgB: ChatMessage = {
      id: 9,
      username: "bob",
      user_id: 11,
      message: "Message 9",
      timestamp: "10:00:00 AM",
      created_at: "2026-08-04T10:00:00.000Z",
    };

    const sorted = sortAndDeduplicateMessages([msgB, msgA]);

    expect(sorted.map((m) => m.id)).toEqual([5, 9]);
  });
});
