import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const instance = io(SERVER_URL, { transports: ["websocket", "polling"] });
    setSocket(instance);

    instance.on("connect", () => setConnected(true));
    instance.on("disconnect", () => setConnected(false));

    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, []);

  return { socket, connected };
}
