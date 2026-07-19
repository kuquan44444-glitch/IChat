const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.ObjectId,
      ref: "Conversation",
      required: true,
    },
    to: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    from: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["Text", "Link", "Image", "Video", "File", "Document", "Media"],
      default: "Text",
    },
    text: {
      type: String,
      default: "",
    },
    file: {
      key: String,
      url: String,
      name: String,
      mimeType: String,
      size: Number,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "messages",
  }
);

messageSchema.index({ conversation: 1, created_at: 1 });

module.exports = mongoose.model("Message", messageSchema);
