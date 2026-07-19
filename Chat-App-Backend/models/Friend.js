const mongoose = require("mongoose");

const friendSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "blocked"],
      default: "pending",
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "friends",
  }
);

friendSchema.index({ requester: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model("Friend", friendSchema);
