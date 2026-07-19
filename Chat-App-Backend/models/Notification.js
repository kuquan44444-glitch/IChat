const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
    conversation: {
      type: mongoose.Schema.ObjectId,
      ref: "Conversation",
      default: null,
    },
    message: {
      type: mongoose.Schema.ObjectId,
      ref: "Message",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "friend_request",
        "friend_request_accepted",
        "message",
        "audio_call",
        "video_call",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "notifications",
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
