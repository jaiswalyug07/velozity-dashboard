import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api";

const WS_URL: string = (import.meta.env.VITE_WS_URL as string | undefined) ?? window.location.origin;

export type ClientSocket = Socket;

let socket: ClientSocket | null = null;

/**
 * Lazily creates a singleton Socket.IO client. The JWT access token is sent
 * in the handshake auth and re-sent on every re-connect attempt by Socket.IO.
 */
export function getSocket(): ClientSocket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: true,
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: (cb) => cb({ token: getAccessToken() }),
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}