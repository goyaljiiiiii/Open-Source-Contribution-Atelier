import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "../lib/authToken";

type CursorInfo = {
  row: number;
  col: number;
};

type RemoteCursor = {
  id: number;
  name: string;
  cursor: CursorInfo;
};

type PresenceInfo = {
  id: number;
  name: string;
};

type DocState = {
  content: string;
  revision: number;
};

type UseLessonEditorWSOptions = {
  slug: string;
  onDocInit?: (state: DocState) => void;
  onRemoteOp?: (op: unknown[], revision: number) => void;
  onRemoteCursor?: (cursor: RemoteCursor) => void;
  onPresence?: (action: "join" | "leave", user: PresenceInfo) => void;
  onSaveAck?: () => void;
  onRebase?: (state: DocState) => void;
};

export function useLessonEditorWS({
  slug,
  onDocInit,
  onRemoteOp,
  onRemoteCursor,
  onPresence,
  onSaveAck,
  onRebase,
}: UseLessonEditorWSOptions) {
  const [connected, setConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<PresenceInfo[]>([]);
  const revisionRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingOpsRef = useRef<unknown[]>([]);
  const onDocInitRef = useRef(onDocInit);
  const onRemoteOpRef = useRef(onRemoteOp);
  const onRemoteCursorRef = useRef(onRemoteCursor);
  const onPresenceRef = useRef(onPresence);
  const onSaveAckRef = useRef(onSaveAck);
  const onRebaseRef = useRef(onRebase);

  useEffect(() => {
    onDocInitRef.current = onDocInit;
  }, [onDocInit]);

  useEffect(() => {
    onRemoteOpRef.current = onRemoteOp;
  }, [onRemoteOp]);

  useEffect(() => {
    onRemoteCursorRef.current = onRemoteCursor;
  }, [onRemoteCursor]);

  useEffect(() => {
    onPresenceRef.current = onPresence;
  }, [onPresence]);

  useEffect(() => {
    onSaveAckRef.current = onSaveAck;
  }, [onSaveAck]);

  useEffect(() => {
    onRebaseRef.current = onRebase;
  }, [onRebase]);

  useEffect(() => {
    const token = getAccessToken();
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
    const host = apiBase.replace(/^https?:\/\//, "").replace(/\/api$/, "");
    const scheme = apiBase.startsWith("https") ? "wss" : "ws";
    const url = `${scheme}://${host}/ws/lesson-editor/${slug}/?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "doc_init":
            revisionRef.current = data.revision;
            onDocInitRef.current?.({ content: data.content, revision: data.revision });
            break;
          case "op":
            revisionRef.current = data.revision;
            onRemoteOpRef.current?.(data.op, data.revision);
            break;
          case "cursor":
            onRemoteCursorRef.current?.(data.cursor as RemoteCursor);
            break;
          case "presence":
            if (data.action === "join") {
              setCollaborators((prev) => {
                const exists = prev.some((u) => u.id === data.user.id);
                return exists ? prev : [...prev, data.user];
              });
            } else {
              setCollaborators((prev) =>
                prev.filter((u) => u.id !== data.user.id),
              );
            }
            onPresenceRef.current?.(data.action, data.user);
            break;
          case "save_ack":
            onSaveAckRef.current?.();
            break;
          case "rebase":
            revisionRef.current = data.revision;
            onRebaseRef.current?.({ content: data.content, revision: data.revision });
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [slug]);

  const sendOp = useCallback((op: unknown[]) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({ type: "op", op, revision: revisionRef.current }),
    );
    revisionRef.current += 1;
  }, []);

  const sendCursor = useCallback((cursor: CursorInfo, user: { id: number; name: string }) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "cursor", cursor, user }));
  }, []);

  const sendSave = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "save" }));
  }, []);

  return { connected, collaborators, sendOp, sendCursor, sendSave };
}
