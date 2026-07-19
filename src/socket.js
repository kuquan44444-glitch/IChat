import io from "socket.io-client"; // Add this

let socket;
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || undefined;

const connectSocket = (user_id) => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    query: { user_id },
  });

  return socket;
};

export {socket, connectSocket};
