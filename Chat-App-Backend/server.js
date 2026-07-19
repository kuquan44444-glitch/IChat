const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

process.on("uncaughtException", (err) => {
  console.log(err);
  console.log("UNCAUGHT Exception! Shutting down ...");
  process.exit(1);
});

const app = require("./app");
const User = require("./models/user");
const Friend = require("./models/Friend");
const Conversation = require("./models/Conversation");
const Message = require("./models/Message");
const Notification = require("./models/Notification");
const AudioCall = require("./models/audioCall");
const VideoCall = require("./models/videoCall");
const { parseAllowedOrigins, validateEnvironment } = require("./utils/env");

validateEnvironment();

const server = http.createServer(app);
const allowedOrigins = parseAllowedOrigins(
  process.env.CORS_ALLOWED_ORIGINS || process.env.CLIENT_URL || ""
);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const emitUserStatus = (userId, status) => {
  io.emit("user_status_changed", { user_id: userId, status });
};

const emitNotification = (userId, payload) => {
  io.to(`user:${userId}`).emit("notification:new", payload);
};

const mapConversation = async (conversationId) => {
  const conversation = await Conversation.findById(conversationId)
    .populate("participants", "firstName lastName avatar _id email status about")
    .populate("lastMessage");

  if (!conversation) {
    return null;
  }

  const messages = conversation.lastMessage ? [conversation.lastMessage] : [];

  return {
    ...conversation.toObject(),
    messages,
  };
};

const createMessageRecord = async ({
  conversationId,
  from,
  to,
  type,
  text = "",
  file = "",
  fileName = "",
  mimeType = "",
  size = 0,
}) => {
  const messageDoc = await Message.create({
    conversation: conversationId,
    from,
    to,
    type,
    text,
    file,
    fileName,
    mimeType,
    size,
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: messageDoc._id,
    lastMessageText: text || fileName || type,
    lastMessageType: type,
    lastMessageAt: messageDoc.created_at,
  });

  return messageDoc;
};

io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return next(new Error("Authentication token is required."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next(new Error("User not found."));
    }

    socket.data.user = user;
    return next();
  } catch (error) {
    return next(new Error("Authentication failed."));
  }
});

io.on("connection", async (socket) => {
  const user = socket.data.user;
  const userId = user._id.toString();

  await User.findByIdAndUpdate(userId, {
    socket_id: socket.id,
    status: "Online",
  });

  socket.join(`user:${userId}`);
  emitUserStatus(userId, "Online");

  socket.on("friend_request", async (data) => {
    try {
      const recipientId = String(data.to || "");
      if (!recipientId || recipientId === userId) {
        return;
      }

      const existingRelation = await Friend.findOne({
        $or: [
          { requester: userId, recipient: recipientId },
          { requester: recipientId, recipient: userId },
        ],
      });

      if (existingRelation) {
        socket.emit("request_sent", {
          message: "Friend request already exists.",
        });
        return;
      }

      const request = await Friend.create({
        requester: userId,
        recipient: recipientId,
        status: "pending",
      });

      const notification = await Notification.create({
        user: recipientId,
        actor: userId,
        type: "friend_request",
        title: "New friend request",
        body: `${user.firstName} ${user.lastName} sent you a friend request.`,
        metadata: { requestId: request._id },
      });

      io.to(`user:${recipientId}`).emit("new_friend_request", {
        message: "New friend request received",
        request_id: request._id,
      });
      emitNotification(recipientId, notification);
      socket.emit("request_sent", {
        message: "Request Sent successfully!",
      });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("accept_request", async (data) => {
    try {
      const requestDoc = await Friend.findOne({
        _id: data.request_id,
        recipient: userId,
        status: "pending",
      });

      if (!requestDoc) {
        return;
      }

      requestDoc.status = "accepted";
      requestDoc.acceptedAt = new Date();
      await requestDoc.save();

      await User.findByIdAndUpdate(requestDoc.requester, {
        $addToSet: { friends: requestDoc.recipient },
      });
      await User.findByIdAndUpdate(requestDoc.recipient, {
        $addToSet: { friends: requestDoc.requester },
      });

      const notification = await Notification.create({
        user: requestDoc.requester,
        actor: userId,
        type: "friend_request_accepted",
        title: "Friend request accepted",
        body: `${user.firstName} ${user.lastName} accepted your friend request.`,
        metadata: { requestId: requestDoc._id },
      });

      io.to(`user:${requestDoc.requester}`).emit("request_accepted", {
        message: "Friend Request Accepted",
      });
      io.to(`user:${requestDoc.recipient}`).emit("request_accepted", {
        message: "Friend Request Accepted",
      });
      emitNotification(requestDoc.requester.toString(), notification);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("get_direct_conversations", async (_payload, callback) => {
    try {
      const conversations = await Conversation.find({
        participants: { $all: [userId] },
      })
        .sort({ lastMessageAt: -1 })
        .populate("participants", "firstName lastName avatar _id email status about")
        .populate("lastMessage");

      const formatted = conversations.map((conversation) => ({
        ...conversation.toObject(),
        messages: conversation.lastMessage ? [conversation.lastMessage] : [],
      }));

      callback(formatted);
    } catch (error) {
      console.log(error);
      callback([]);
    }
  });

  socket.on("start_conversation", async (data) => {
    try {
      const to = String(data.to || "");

      if (!to || to === userId) {
        return;
      }

      let conversation = await Conversation.findOne({
        participants: { $size: 2, $all: [to, userId] },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [to, userId],
        });
      }

      const mappedConversation = await mapConversation(conversation._id);
      socket.emit("start_chat", mappedConversation);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("get_messages", async (data, callback) => {
    try {
      const conversationId = data.conversation_id;
      const messages = await Message.find({
        conversation: conversationId,
      }).sort({ created_at: 1 });

      callback(messages);
    } catch (error) {
      console.log(error);
      callback([]);
    }
  });

  socket.on("typing_start", async ({ to, conversation_id }) => {
    io.to(`user:${to}`).emit("typing_start", {
      conversation_id,
      from: userId,
    });
  });

  socket.on("typing_stop", async ({ to, conversation_id }) => {
    io.to(`user:${to}`).emit("typing_stop", {
      conversation_id,
      from: userId,
    });
  });

  socket.on("text_message", async (data) => {
    try {
      const { message, conversation_id, to, type } = data;

      const conversation = await Conversation.findOne({
        _id: conversation_id,
        participants: { $all: [userId, to] },
      });

      if (!conversation) {
        return;
      }

      const newMessage = await createMessageRecord({
        conversationId: conversation_id,
        from: userId,
        to,
        type: type || "Text",
        text: message,
      });

      const notification = await Notification.create({
        user: to,
        actor: userId,
        conversation: conversation_id,
        message: newMessage._id,
        type: "message",
        title: "New message",
        body: message,
      });

      io.to(`user:${to}`).emit("new_message", {
        conversation_id,
        message: newMessage,
      });

      io.to(`user:${userId}`).emit("new_message", {
        conversation_id,
        message: newMessage,
      });

      emitNotification(to, notification);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("file_message", async (data) => {
    try {
      const { conversation_id, to, type, text, file, fileName, mimeType, size } = data;

      const conversation = await Conversation.findOne({
        _id: conversation_id,
        participants: { $all: [userId, to] },
      });

      if (!conversation) {
        return;
      }

      const newMessage = await createMessageRecord({
        conversationId: conversation_id,
        from: userId,
        to,
        type: type || "Document",
        text: text || "",
        file,
        fileName,
        mimeType,
        size,
      });

      const notification = await Notification.create({
        user: to,
        actor: userId,
        conversation: conversation_id,
        message: newMessage._id,
        type: "message",
        title: "New file received",
        body: fileName || "File attachment",
      });

      io.to(`user:${to}`).emit("new_message", {
        conversation_id,
        message: newMessage,
      });
      io.to(`user:${userId}`).emit("new_message", {
        conversation_id,
        message: newMessage,
      });
      emitNotification(to, notification);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("start_audio_call", async (data) => {
    try {
      const { to, roomID } = data;
      const toUser = await User.findById(to);
      const fromUser = await User.findById(userId);

      if (!toUser) {
        return;
      }

      const notification = await Notification.create({
        user: to,
        actor: userId,
        type: "audio_call",
        title: "Incoming audio call",
        body: `${fromUser.firstName} ${fromUser.lastName} is calling you.`,
        metadata: { roomID },
      });

      io.to(`user:${to}`).emit("audio_call_notification", {
        from_user: fromUser,
        roomID,
        streamID: userId,
        recipientID: userId,
        userID: to,
        userName: `${toUser.firstName} ${toUser.lastName}`.trim(),
        from: to,
        to: userId,
      });
      emitNotification(to, notification);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("audio_call_not_picked", async (data) => {
    try {
      const { to, from } = data;
      await AudioCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Missed", status: "Ended", endedAt: Date.now() }
      );

      io.to(`user:${to}`).emit("audio_call_missed", { from, to });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("audio_call_accepted", async (data) => {
    try {
      const { to, from } = data;
      await AudioCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Accepted" }
      );

      io.to(`user:${to}`).emit("audio_call_accepted", { from, to });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("audio_call_denied", async (data) => {
    try {
      const { to, from } = data;
      await AudioCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Denied", status: "Ended", endedAt: Date.now() }
      );

      io.to(`user:${to}`).emit("audio_call_denied", { from, to });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("user_is_busy_audio_call", async (data) => {
    try {
      const { to, from } = data;
      await AudioCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Busy", status: "Ended", endedAt: Date.now() }
      );

      io.to(`user:${to}`).emit("on_another_audio_call", { from, to });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("start_video_call", async (data) => {
    try {
      const { to, roomID } = data;
      const toUser = await User.findById(to);
      const fromUser = await User.findById(userId);

      if (!toUser) {
        return;
      }

      const notification = await Notification.create({
        user: to,
        actor: userId,
        type: "video_call",
        title: "Incoming video call",
        body: `${fromUser.firstName} ${fromUser.lastName} is calling you.`,
        metadata: { roomID },
      });

      io.to(`user:${to}`).emit("video_call_notification", {
        from_user: fromUser,
        roomID,
        streamID: userId,
        recipientID: userId,
        userID: to,
        userName: `${toUser.firstName} ${toUser.lastName}`.trim(),
        from: to,
        to: userId,
      });
      emitNotification(to, notification);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("video_call_not_picked", async (data) => {
    try {
      const { to, from } = data;
      await VideoCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Missed", status: "Ended", endedAt: Date.now() }
      );

      io.to(`user:${to}`).emit("video_call_missed", { from, to });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("video_call_accepted", async (data) => {
    try {
      const { to, from } = data;
      await VideoCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Accepted" }
      );

      io.to(`user:${to}`).emit("video_call_accepted", { from, to });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("video_call_denied", async (data) => {
    try {
      const { to, from } = data;
      await VideoCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Denied", status: "Ended", endedAt: Date.now() }
      );

      io.to(`user:${to}`).emit("video_call_denied", { from, to });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("user_is_busy_video_call", async (data) => {
    try {
      const { to, from } = data;
      await VideoCall.findOneAndUpdate(
        {
          participants: { $size: 2, $all: [to, from] },
        },
        { verdict: "Busy", status: "Ended", endedAt: Date.now() }
      );

      io.to(`user:${to}`).emit("on_another_video_call", { from, to });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("end", async () => {
    await User.findByIdAndUpdate(userId, { status: "Offline", socket_id: "" });
    emitUserStatus(userId, "Offline");
    socket.disconnect(true);
  });

  socket.on("disconnect", async () => {
    await User.findByIdAndUpdate(userId, { status: "Offline", socket_id: "" });
    emitUserStatus(userId, "Offline");
  });
});

const DB = process.env.DATABASE;
const port = process.env.PORT || 8000;

mongoose
  .connect(DB)
  .then(() => {
    console.log("DB Connection successful");
    server.listen(port, () => {
      console.log(`App running on port ${port} ...`);
    });
  })
  .catch((err) => {
    console.log("DB Connection failed:", err.message);
    process.exit(1);
  });

const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("unhandledRejection", (err) => {
  console.log("Unhandled rejection:", err.message);
  gracefulShutdown("unhandledRejection");
});
