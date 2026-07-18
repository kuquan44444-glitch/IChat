import io from "socket.io-client"; // Add this
import { SOCKET_URL } from "./config";

let socket;

const connectSocket = (user_id) => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL || undefined, {
    query: { user_id },
    transports: ["websocket", "polling"],
  });
  return socket;
};

const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
};

export { socket, connectSocket, disconnectSocket };
