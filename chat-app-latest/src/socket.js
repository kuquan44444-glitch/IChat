import io from "socket.io-client"; // Add this
import { SOCKET_URL } from "./config";

let socket;

const connectSocket = (user_id) => {
  socket = io(SOCKET_URL || undefined, {
    query: { user_id },
    transports: ["websocket", "polling"],
  });
};

export {socket, connectSocket};
