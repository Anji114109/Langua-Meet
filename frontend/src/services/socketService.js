import { io } from "socket.io-client";

const SOCKET_URL = `${window.location.protocol}//${window.location.hostname}:5000`;

let socket;
let activeToken;

export const getSocket = (token) => {
  if (!token) {
    throw new Error("Auth token is required for socket connection");
  }

  if (socket && activeToken !== token) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    activeToken = token;
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: {
        token,
      },
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    activeToken = null;
  }
};
