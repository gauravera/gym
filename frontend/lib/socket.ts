import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (!socket) {
    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    socket = io(wsUrl, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket"],
    });
  } else if (socket.disconnected) {
    socket.connect();
  }
  return socket;
}

export function getSocket(): Socket {
  if (!socket) {
    return connectSocket();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }
}
