const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

process.on("uncaughtException", (err) => {
  console.log(err);
  console.log("UNCAUGHT Exception! Shutting down ...");
  process.exit(1);
});

const app = require("./app");

const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const Conversation = require("./models/Conversation");
const Friend = require("./models/Friend");
const Message = require("./models/Message");
const Notification = require("./models/Notification");
const User = require("./models/user");
const AudioCall = require("./models/audioCall");
const VideoCall = require("./models/videoCall");
const { getPublicFileUrl } = require("./utils/storage");

const socketCors = {
  methods: ["GET", "POST"],
};

if (process.env.CLIENT_URL) {
  socketCors.origin = process.env.CLIENT_URL;
}

const io = new Server(server, {
  cors: socketCors,
});

const DB = process.env.DATABASE;

mongoose
  .connect(DB)
  .then(() => {
    console.log("DB Connection successful");
  })
  .catch((err) => {
    console.log("DB Connection failed:", err.message);
    process.exit(1);
  });

const port = process.env.PORT || 8000;

server.listen(port, () => {
  console.log(`App running on port ${port} ...`);
});

const serializeUser = (userDoc) => {
  if (!userDoc) {
    return null;
  }

  return {
    _id: userDoc._id,
    firstName: userDoc.firstName,
    lastName: userDoc.lastName,
    email: userDoc.email,
    avatar: getPublicFileUrl(userDoc.avatar),
    about: userDoc.about,
    status: userDoc.status,
    verified: userDoc.verified,
    socket_id: userDoc.socket_id,
  };
};

const emitUserStatus = async (userId, status) => {
  const user = await User.findById(userId);

  if (!user) {
    return;
  }

  io.emit("user_status_changed", {
    user_id: user._id.toString(),
    status,
  });
};

const emitNotification = async ({
  recipientId,
  actorId,
  type,
  title,
  message,
  data,
}) => {
  const notification = await Notification.create({
    user: recipientId,
    actor: actorId,
    type,
    title,
    message,
    data,
  });

  const recipient = await User.findById(recipientId).select("socket_id");
  io.to(recipient?.socket_id).emit("new_notification", notification);
};

io.on("connection", async (socket) => {
  const user_id = socket.handshake.query["user_id"];

  if (user_id) {
    try {
      await User.findByIdAndUpdate(user_id, {
        socket_id: socket.id,
        status: "Online",
      });
      await emitUserStatus(user_id, "Online");
    } catch (error) {
      console.log(error);
    }
  }

  socket.on("friend_request", async (data) => {
    const to = await User.findById(data.to);
    const from = await User.findById(data.from);

    if (!to || !from || to._id.toString() === from._id.toString()) {
      return;
    }

    const existingRelation = await Friend.findOne({
      $or: [
        { requester: data.from, recipient: data.to },
        { requester: data.to, recipient: data.from },
      ],
    });

    if (existingRelation) {
      io.to(from?.socket_id).emit("request_sent", {
        message:
          existingRelation.status === "accepted"
            ? "You are already friends"
            : "Friend request already exists",
      });
      return;
    }

    const request = await Friend.create({
      requester: data.from,
      recipient: data.to,
    });

    io.to(to?.socket_id).emit("new_friend_request", {
      message: "New friend request received",
      request: {
        _id: request._id,
        sender: serializeUser(from),
      },
    });
    io.to(from?.socket_id).emit("request_sent", {
      message: "Request Sent successfully!",
    });

    await emitNotification({
      recipientId: to._id,
      actorId: from._id,
      type: "friend_request",
      title: "New friend request",
      message: `${from.firstName} ${from.lastName} sent you a friend request`,
      data: { requestId: request._id },
    });
  });

  socket.on("accept_request", async (data) => {
    const request = await Friend.findById(data.request_id);

    if (!request) {
      return;
    }

    const sender = await User.findById(request.requester);
    const receiver = await User.findById(request.recipient);

    request.status = "accepted";
    request.acceptedAt = Date.now();
    await request.save();

    if (sender && receiver) {
      const senderHasReceiver = sender.friends.some(
        (friendId) => friendId.toString() === receiver._id.toString()
      );
      const receiverHasSender = receiver.friends.some(
        (friendId) => friendId.toString() === sender._id.toString()
      );

      if (!senderHasReceiver) {
        sender.friends.push(receiver._id);
      }

      if (!receiverHasSender) {
        receiver.friends.push(sender._id);
      }

      await Promise.all([
        sender.save({ new: true, validateModifiedOnly: true }),
        receiver.save({ new: true, validateModifiedOnly: true }),
      ]);

      io.to(sender?.socket_id).emit("request_accepted", {
        message: "Friend Request Accepted",
      });
      io.to(receiver?.socket_id).emit("request_accepted", {
        message: "Friend Request Accepted",
      });

      await emitNotification({
        recipientId: sender._id,
        actorId: receiver._id,
        type: "friend_request_accepted",
        title: "Friend request accepted",
        message: `${receiver.firstName} ${receiver.lastName} accepted your friend request`,
        data: { requestId: request._id },
      });
    }
  });

  socket.on("get_direct_conversations", async ({ user_id: currentUserId }, callback) => {
    const conversations = await Conversation.find({
      participants: { $all: [currentUserId] },
    })
      .populate("participants", "firstName lastName avatar _id email status about verified socket_id")
      .sort({ lastMessageAt: -1 });

    callback(
      conversations.map((conversation) => ({
        _id: conversation._id,
        participants: conversation.participants.map(serializeUser),
        lastMessage: conversation.lastMessage,
        lastMessageType: conversation.lastMessageType,
        lastMessageAt: conversation.lastMessageAt,
      }))
    );
  });

  socket.on("start_conversation", async (data) => {
    const { to, from } = data;

    let conversation = await Conversation.findOne({
      participants: { $size: 2, $all: [to, from] },
    }).populate("participants", "firstName lastName _id email status about avatar verified socket_id");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [to, from],
      });

      conversation = await Conversation.findById(conversation._id).populate(
        "participants",
        "firstName lastName _id email status about avatar verified socket_id"
      );
    }

    socket.emit("start_chat", {
      _id: conversation._id,
      participants: conversation.participants.map(serializeUser),
      lastMessage: conversation.lastMessage,
      lastMessageType: conversation.lastMessageType,
      lastMessageAt: conversation.lastMessageAt,
    });
  });

  socket.on("get_messages", async (data, callback) => {
    try {
      const messages = await Message.find({
        conversation: data.conversation_id,
      }).sort({ created_at: 1 });
      callback(messages);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("text_message", async (data) => {
    const { message, conversation_id, from, to, type } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);
    const newMessage = await Message.create({
      conversation: conversation_id,
      to,
      from,
      type,
      text: message,
    });

    await Conversation.findByIdAndUpdate(conversation_id, {
      lastMessage: message,
      lastMessageType: type,
      lastMessageAt: newMessage.created_at,
    });

    io.to(to_user?.socket_id).emit("new_message", {
      conversation_id,
      message: newMessage,
    });
    io.to(from_user?.socket_id).emit("new_message", {
      conversation_id,
      message: newMessage,
    });

    if (to_user && from_user) {
      await emitNotification({
        recipientId: to_user._id,
        actorId: from_user._id,
        type: "new_message",
        title: "New message",
        message: `${from_user.firstName} ${from_user.lastName} sent you a message`,
        data: {
          conversationId: conversation_id,
          messageId: newMessage._id,
        },
      });
    }
  });

  socket.on("file_message", async (data) => {
    const { conversation_id, from, to, type, message, file } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);
    const newMessage = await Message.create({
      conversation: conversation_id,
      to,
      from,
      type,
      text: message || "",
      file,
    });

    await Conversation.findByIdAndUpdate(conversation_id, {
      lastMessage: message || file?.name || "Attachment",
      lastMessageType: type,
      lastMessageAt: newMessage.created_at,
    });

    io.to(to_user?.socket_id).emit("new_message", {
      conversation_id,
      message: newMessage,
    });
    io.to(from_user?.socket_id).emit("new_message", {
      conversation_id,
      message: newMessage,
    });

    if (to_user && from_user) {
      await emitNotification({
        recipientId: to_user._id,
        actorId: from_user._id,
        type: "new_message",
        title: "New attachment",
        message: `${from_user.firstName} ${from_user.lastName} sent you an attachment`,
        data: {
          conversationId: conversation_id,
          messageId: newMessage._id,
        },
      });
    }
  });

  socket.on("typing", async (data) => {
    const to_user = await User.findById(data.to).select("socket_id");
    io.to(to_user?.socket_id).emit("typing", {
      conversation_id: data.conversation_id,
      from: data.from,
    });
  });

  socket.on("stop_typing", async (data) => {
    const to_user = await User.findById(data.to).select("socket_id");
    io.to(to_user?.socket_id).emit("stop_typing", {
      conversation_id: data.conversation_id,
      from: data.from,
    });
  });

  socket.on("start_audio_call", async (data) => {
    const { from, to, roomID } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    io.to(to_user?.socket_id).emit("audio_call_notification", {
      from_user: serializeUser(from_user),
      roomID,
      streamID: from,
      userID: to,
      userName: to,
    });
  });

  socket.on("audio_call_not_picked", async (data) => {
    const { to, from } = data;
    const to_user = await User.findById(to);

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Missed", status: "Ended", endedAt: Date.now() }
    );

    io.to(to_user?.socket_id).emit("audio_call_missed", {
      from,
      to,
    });
  });

  socket.on("audio_call_accepted", async (data) => {
    const { to, from } = data;
    const from_user = await User.findById(from);

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Accepted" }
    );

    io.to(from_user?.socket_id).emit("audio_call_accepted", {
      from,
      to,
    });
  });

  socket.on("audio_call_denied", async (data) => {
    const { to, from } = data;
    const from_user = await User.findById(from);

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Denied", status: "Ended", endedAt: Date.now() }
    );

    io.to(from_user?.socket_id).emit("audio_call_denied", {
      from,
      to,
    });
  });

  socket.on("user_is_busy_audio_call", async (data) => {
    const { to, from } = data;
    const from_user = await User.findById(from);

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Busy", status: "Ended", endedAt: Date.now() }
    );

    io.to(from_user?.socket_id).emit("on_another_audio_call", {
      from,
      to,
    });
  });

  socket.on("start_video_call", async (data) => {
    const { from, to, roomID } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    io.to(to_user?.socket_id).emit("video_call_notification", {
      from_user: serializeUser(from_user),
      roomID,
      streamID: from,
      userID: to,
      userName: to,
    });
  });

  socket.on("video_call_not_picked", async (data) => {
    const { to, from } = data;
    const to_user = await User.findById(to);

    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Missed", status: "Ended", endedAt: Date.now() }
    );

    io.to(to_user?.socket_id).emit("video_call_missed", {
      from,
      to,
    });
  });

  socket.on("video_call_accepted", async (data) => {
    const { to, from } = data;
    const from_user = await User.findById(from);

    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Accepted" }
    );

    io.to(from_user?.socket_id).emit("video_call_accepted", {
      from,
      to,
    });
  });

  socket.on("video_call_denied", async (data) => {
    const { to, from } = data;
    const from_user = await User.findById(from);

    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Denied", status: "Ended", endedAt: Date.now() }
    );

    io.to(from_user?.socket_id).emit("video_call_denied", {
      from,
      to,
    });
  });

  socket.on("user_is_busy_video_call", async (data) => {
    const { to, from } = data;
    const from_user = await User.findById(from);

    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Busy", status: "Ended", endedAt: Date.now() }
    );

    io.to(from_user?.socket_id).emit("on_another_video_call", {
      from,
      to,
    });
  });

  socket.on("end", async (data) => {
    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, {
        status: "Offline",
        socket_id: null,
      });
      await emitUserStatus(data.user_id, "Offline");
    }

    socket.disconnect(0);
  });

  socket.on("disconnect", async () => {
    if (user_id) {
      await User.findByIdAndUpdate(user_id, {
        status: "Offline",
        socket_id: null,
      });
      await emitUserStatus(user_id, "Offline");
    }
  });
});

process.on("unhandledRejection", (err) => {
  console.log("Unhandled rejection:", err.message);
  console.log("Server will continue running...");
});
