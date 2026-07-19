const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    to: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    from: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["Text", "Media", "Document", "Link"],
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    file: {
      type: String,
      default: "",
    },
    fileName: {
      type: String,
      default: "",
    },
    mimeType: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "messages",
  }
);

messageSchema.index({ conversation: 1, created_at: 1 });

module.exports = mongoose.model("Message", messageSchema);
