import io from "socket.io-client"; // Add this

let socket;
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || undefined;

const connectSocket = (user_id) => {
  socket = io(SOCKET_URL, {
    query: { user_id },
  });
} // Add this -- our server will run on port 4000, so we connect to it from here

export {socket, connectSocket};
