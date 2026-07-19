const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.ObjectId,
      ref: "Message",
      default: null,
    },
    lastMessageText: {
      type: String,
      default: "",
    },
    lastMessageType: {
      type: String,
      enum: ["Text", "Media", "Document", "Link"],
      default: "Text",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "conversations",
  }
);

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
