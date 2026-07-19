import io from "socket.io-client";
import { SOCKET_URL } from "./config";

let socket;

const connectSocket = (token) => {
  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
  });
};

export { socket, connectSocket };
