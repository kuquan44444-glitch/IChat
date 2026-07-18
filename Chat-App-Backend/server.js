const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "config.env") });

const app = require("./app");
const User = require("./models/user");
const FriendRequest = require("./models/friendRequest");
const OneToOneMessage = require("./models/OneToOneMessage");
const AudioCall = require("./models/audioCall");
const VideoCall = require("./models/videoCall");

const port = process.env.PORT || 8000;
const server = http.createServer(app);

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const resolveMongoUri = () => {
  let mongoUri = process.env.MONGODB_URI || process.env.DATABASE;

  if (!mongoUri) {
    throw new Error("Missing MongoDB configuration. Set MONGODB_URI in the environment.");
  }

  if (mongoUri.includes("<PASSWORD>") && process.env.DATABASE_PASSWORD) {
    mongoUri = mongoUri.replace("<PASSWORD>", process.env.DATABASE_PASSWORD);
  }

  return mongoUri;
};

const connectDatabase = async () => {
  await mongoose.connect(resolveMongoUri());
  console.log("MongoDB connected");
};

const setUserPresence = async (userId, data) => {
  if (!userId) {
    return;
  }

  await User.findByIdAndUpdate(userId, data, {
    new: true,
    validateModifiedOnly: true,
  });
};

const handleSocketError = (socket, eventName, error) => {
  console.error(`Socket error in ${eventName}:`, error);
  socket.emit("socket_error", {
    event: eventName,
    message: error.message || "Unexpected socket error",
  });
};

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.user_id;
  console.log(`User connected ${socket.id}`);

  try {
    await setUserPresence(userId, {
      socket_id: socket.id,
      status: "Online",
    });
  } catch (error) {
    handleSocketError(socket, "connection", error);
  }

  socket.on("friend_request", async (data) => {
    try {
      const to = await User.findById(data.to).select("socket_id");
      const from = await User.findById(data.from).select("socket_id");

      const existingRequest = await FriendRequest.findOne({
        sender: data.from,
        recipient: data.to,
      });

      if (!existingRequest) {
        await FriendRequest.create({
          sender: data.from,
          recipient: data.to,
        });
      }

      io.to(to?.socket_id).emit("new_friend_request", {
        message: "New friend request received",
      });
      io.to(from?.socket_id).emit("request_sent", {
        message: "Request Sent successfully!",
      });
    } catch (error) {
      handleSocketError(socket, "friend_request", error);
    }
  });

  socket.on("accept_request", async (data) => {
    try {
      const requestDoc = await FriendRequest.findById(data.request_id);

      if (!requestDoc) {
        return;
      }

      const sender = await User.findById(requestDoc.sender);
      const receiver = await User.findById(requestDoc.recipient);

      if (!sender || !receiver) {
        return;
      }

      if (!sender.friends.some((friendId) => friendId.toString() === receiver._id.toString())) {
        sender.friends.push(receiver._id);
      }

      if (!receiver.friends.some((friendId) => friendId.toString() === sender._id.toString())) {
        receiver.friends.push(sender._id);
      }

      await receiver.save({ new: true, validateModifiedOnly: true });
      await sender.save({ new: true, validateModifiedOnly: true });
      await FriendRequest.findByIdAndDelete(data.request_id);

      io.to(sender?.socket_id).emit("request_accepted", {
        message: "Friend Request Accepted",
      });
      io.to(receiver?.socket_id).emit("request_accepted", {
        message: "Friend Request Accepted",
      });
    } catch (error) {
      handleSocketError(socket, "accept_request", error);
    }
  });

  socket.on("get_direct_conversations", async ({ user_id: requestUserId }, callback) => {
    try {
      const conversations = await OneToOneMessage.find({
        participants: { $all: [requestUserId] },
      }).populate("participants", "firstName lastName avatar _id email status about");

      callback(conversations);
    } catch (error) {
      handleSocketError(socket, "get_direct_conversations", error);
      callback([]);
    }
  });

  socket.on("start_conversation", async (data) => {
    try {
      const { to, from } = data;
      const existingConversations = await OneToOneMessage.find({
        participants: { $size: 2, $all: [to, from] },
      }).populate("participants", "firstName lastName _id email status about avatar");

      if (existingConversations.length === 0) {
        let newChat = await OneToOneMessage.create({
          participants: [to, from],
        });

        newChat = await OneToOneMessage.findById(newChat._id).populate(
          "participants",
          "firstName lastName _id email status about avatar"
        );

        socket.emit("start_chat", newChat);
        return;
      }

      socket.emit("start_chat", existingConversations[0]);
    } catch (error) {
      handleSocketError(socket, "start_conversation", error);
    }
  });

  socket.on("get_messages", async (data, callback) => {
    try {
      const conversation = await OneToOneMessage.findById(data.conversation_id).select(
        "messages"
      );
      callback(conversation?.messages || []);
    } catch (error) {
      handleSocketError(socket, "get_messages", error);
      callback([]);
    }
  });

  socket.on("text_message", async (data) => {
    try {
      const { message, conversation_id: conversationId, from, to, type } = data;

      const [toUser, fromUser, chat] = await Promise.all([
        User.findById(to),
        User.findById(from),
        OneToOneMessage.findById(conversationId),
      ]);

      if (!chat) {
        return;
      }

      const newMessage = {
        to,
        from,
        type,
        created_at: Date.now(),
        text: message,
      };

      chat.messages.push(newMessage);
      await chat.save({ new: true, validateModifiedOnly: true });

      io.to(toUser?.socket_id).emit("new_message", {
        conversation_id: conversationId,
        message: chat.messages[chat.messages.length - 1],
      });

      io.to(fromUser?.socket_id).emit("new_message", {
        conversation_id: conversationId,
        message: chat.messages[chat.messages.length - 1],
      });
    } catch (error) {
      handleSocketError(socket, "text_message", error);
    }
  });

  socket.on("file_message", (data) => {
    console.log("Received message:", data);
  });

  socket.on("start_audio_call", async (data) => {
    try {
      const { from, to, roomID } = data;
      const [toUser, fromUser] = await Promise.all([
        User.findById(to),
        User.findById(from),
      ]);

      io.to(toUser?.socket_id).emit("audio_call_notification", {
        from: fromUser,
        from_user: fromUser,
        roomID,
        streamID: from,
        userID: to,
        userName: to,
        to,
      });
    } catch (error) {
      handleSocketError(socket, "start_audio_call", error);
    }
  });

  socket.on("audio_call_not_picked", async (data) => {
    try {
      const { to, from } = data;
      const toUser = await User.findById(to);

      await AudioCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Missed", status: "Ended", endedAt: Date.now() }
      );

      io.to(toUser?.socket_id).emit("audio_call_missed", { from, to });
    } catch (error) {
      handleSocketError(socket, "audio_call_not_picked", error);
    }
  });

  socket.on("audio_call_accepted", async (data) => {
    try {
      const { to, from } = data;
      const fromUser = await User.findById(from);

      await AudioCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Accepted" }
      );

      io.to(fromUser?.socket_id).emit("audio_call_accepted", { from, to });
    } catch (error) {
      handleSocketError(socket, "audio_call_accepted", error);
    }
  });

  socket.on("audio_call_denied", async (data) => {
    try {
      const { to, from } = data;
      const fromUser = await User.findById(from);

      await AudioCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Denied", status: "Ended", endedAt: Date.now() }
      );

      io.to(fromUser?.socket_id).emit("audio_call_denied", { from, to });
    } catch (error) {
      handleSocketError(socket, "audio_call_denied", error);
    }
  });

  socket.on("user_is_busy_audio_call", async (data) => {
    try {
      const { to, from } = data;
      const fromUser = await User.findById(from);

      await AudioCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Busy", status: "Ended", endedAt: Date.now() }
      );

      io.to(fromUser?.socket_id).emit("on_another_audio_call", { from, to });
    } catch (error) {
      handleSocketError(socket, "user_is_busy_audio_call", error);
    }
  });

  socket.on("start_video_call", async (data) => {
    try {
      const { from, to, roomID } = data;
      const [toUser, fromUser] = await Promise.all([
        User.findById(to),
        User.findById(from),
      ]);

      io.to(toUser?.socket_id).emit("video_call_notification", {
        from: fromUser,
        from_user: fromUser,
        roomID,
        streamID: from,
        userID: to,
        userName: to,
        to,
      });
    } catch (error) {
      handleSocketError(socket, "start_video_call", error);
    }
  });

  socket.on("video_call_not_picked", async (data) => {
    try {
      const { to, from } = data;
      const toUser = await User.findById(to);

      await VideoCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Missed", status: "Ended", endedAt: Date.now() }
      );

      io.to(toUser?.socket_id).emit("video_call_missed", { from, to });
    } catch (error) {
      handleSocketError(socket, "video_call_not_picked", error);
    }
  });

  socket.on("video_call_accepted", async (data) => {
    try {
      const { to, from } = data;
      const fromUser = await User.findById(from);

      await VideoCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Accepted" }
      );

      io.to(fromUser?.socket_id).emit("video_call_accepted", { from, to });
    } catch (error) {
      handleSocketError(socket, "video_call_accepted", error);
    }
  });

  socket.on("video_call_denied", async (data) => {
    try {
      const { to, from } = data;
      const fromUser = await User.findById(from);

      await VideoCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Denied", status: "Ended", endedAt: Date.now() }
      );

      io.to(fromUser?.socket_id).emit("video_call_denied", { from, to });
    } catch (error) {
      handleSocketError(socket, "video_call_denied", error);
    }
  });

  socket.on("user_is_busy_video_call", async (data) => {
    try {
      const { to, from } = data;
      const fromUser = await User.findById(from);

      await VideoCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Busy", status: "Ended", endedAt: Date.now() }
      );

      io.to(fromUser?.socket_id).emit("on_another_video_call", { from, to });
    } catch (error) {
      handleSocketError(socket, "user_is_busy_video_call", error);
    }
  });

  socket.on("end", async (data) => {
    try {
      await setUserPresence(data.user_id, {
        status: "Offline",
        socket_id: null,
      });
      socket.disconnect(true);
    } catch (error) {
      handleSocketError(socket, "end", error);
    }
  });

  socket.on("disconnect", async () => {
    try {
      await setUserPresence(userId, {
        status: "Offline",
        socket_id: null,
      });
      console.log(`User disconnected ${socket.id}`);
    } catch (error) {
      console.error("Socket disconnect error:", error);
    }
  });
});

let isShuttingDown = false;

const gracefulShutdown = async (signal, error) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (error) {
    console.error(`${signal}:`, error);
  } else {
    console.log(`${signal} received. Starting graceful shutdown...`);
  }

  try {
    await new Promise((resolve, reject) => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
        } else {
          resolve();
        }
      });
    });

    await mongoose.connection.close();
  } catch (shutdownError) {
    console.error("Graceful shutdown failed:", shutdownError);
  } finally {
    process.exit(error ? 1 : 0);
  }
};

process.on("uncaughtException", (error) => {
  gracefulShutdown("uncaughtException", error);
});

process.on("unhandledRejection", (error) => {
  gracefulShutdown("unhandledRejection", error);
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

const start = async () => {
  await connectDatabase();

  server.listen(port, () => {
    console.log(`App running on port ${port}`);
  });
};

start().catch((error) => {
  gracefulShutdown("startup", error);
});
