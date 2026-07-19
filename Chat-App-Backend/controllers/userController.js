const AudioCall = require("../models/audioCall");
const Friend = require("../models/Friend");
const Notification = require("../models/Notification");
const User = require("../models/user");
const VideoCall = require("../models/videoCall");
const catchAsync = require("../utils/catchAsync");
const filterObj = require("../utils/filterObj");
const {
  createSignedUploadUrl,
  generateObjectKey,
  getPublicUrl,
  isStorageConfigured,
} = require("../services/storage");

const { generateToken04 } = require("./zegoServerAssistant");

const appID = process.env.ZEGO_APP_ID;
const serverSecret = process.env.ZEGO_SERVER_SECRET;

exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("firstName lastName email avatar about verified friends status")
    .populate("friends", "_id firstName lastName avatar status");

  res.status(200).json({
    status: "success",
    data: user,
  });
});

exports.updateMe = catchAsync(async (req, res) => {
  const filteredBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "about",
    "avatar"
  );

  const userDoc = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    new: true,
    runValidators: true,
  }).select("firstName lastName email avatar about verified friends status");

  res.status(200).json({
    status: "success",
    data: userDoc,
    message: "User Updated successfully",
  });
});

exports.getUsers = catchAsync(async (req, res) => {
  const currentUser = await User.findById(req.user._id).select("friends");
  const existingRelations = await Friend.find({
    $or: [{ requester: req.user._id }, { recipient: req.user._id }],
  }).select("requester recipient status");

  const excludedIds = new Set([
    req.user._id.toString(),
    ...currentUser.friends.map((friendId) => friendId.toString()),
  ]);

  existingRelations.forEach((relation) => {
    excludedIds.add(relation.requester.toString());
    excludedIds.add(relation.recipient.toString());
  });

  const users = await User.find({
    verified: true,
    _id: { $nin: Array.from(excludedIds) },
  }).select("_id firstName lastName avatar about status");

  res.status(200).json({
    status: "success",
    data: users,
    message: "Users found successfully!",
  });
});

exports.getAllVerifiedUsers = catchAsync(async (req, res) => {
  const all_users = await User.find({
    verified: true,
  }).select("firstName lastName _id avatar about status");

  const remaining_users = all_users.filter(
    (user) => user._id.toString() !== req.user._id.toString()
  );

  res.status(200).json({
    status: "success",
    data: remaining_users,
    message: "Users found successfully!",
  });
});

exports.getRequests = catchAsync(async (req, res) => {
  const requests = await Friend.find({
    recipient: req.user._id,
    status: "pending",
  })
    .populate("requester", "_id firstName lastName avatar about status")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    data: requests,
    message: "Requests found successfully!",
  });
});

exports.getFriends = catchAsync(async (req, res) => {
  const this_user = await User.findById(req.user._id).populate(
    "friends",
    "_id firstName lastName avatar about status"
  );
  res.status(200).json({
    status: "success",
    data: this_user.friends,
    message: "Friends found successfully!",
  });
});

/**
 * Authorization authentication token generation
 */

exports.getNotifications = catchAsync(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .populate("actor", "_id firstName lastName avatar")
    .sort({ createdAt: -1 })
    .limit(50);

  res.status(200).json({
    status: "success",
    data: notifications,
    message: "Notifications found successfully!",
  });
});

exports.createUploadSignature = catchAsync(async (req, res) => {
  const { fileName, contentType, folder } = req.body;

  if (!fileName || !contentType) {
    return res.status(400).json({
      status: "error",
      message: "fileName and contentType are required.",
    });
  }

  if (!isStorageConfigured()) {
    return res.status(503).json({
      status: "error",
      message: "S3 upload is not configured on the server.",
    });
  }

  const key = generateObjectKey({
    folder: folder || "uploads",
    fileName,
    userId: req.user._id.toString(),
  });

  const signedUpload = await createSignedUploadUrl({
    key,
    contentType,
  });

  res.status(200).json({
    status: "success",
    data: signedUpload,
  });
});

exports.generateZegoToken = catchAsync(async (req, res) => {
  try {
    const { room_id } = req.body;
    const userId = String(req.user._id);

    if (!appID || !serverSecret) {
      return res.status(503).json({
        status: "error",
        message: "Zego environment variables are not configured.",
      });
    }

    const effectiveTimeInSeconds = 3600;
    const payloadObject = {
      room_id,
      privilege: {
        1: 1,
        2: 1,
      },
      stream_id_list: null,
    };
    const payload = JSON.stringify(payloadObject);
    const token = generateToken04(
      appID * 1,
      userId,
      serverSecret,
      effectiveTimeInSeconds,
      payload
    );
    res.status(200).json({
      status: "success",
      message: "Token generated successfully",
      token,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      status: "error",
      message: "Unable to generate Zego token.",
    });
  }
});

exports.startAudioCall = catchAsync(async (req, res) => {
  const from = req.user._id;
  const to = req.body.id;

  const to_user = await User.findById(to);
  const from_user = await User.findById(from);

  const new_audio_call = await AudioCall.create({
    participants: [from, to],
    from,
    to,
    status: "Ongoing",
  });

  res.status(200).json({
    data: {
      from: to_user,
      from_user,
      roomID: new_audio_call._id,
      streamID: from,
      recipientID: to,
      userID: from,
      userName: `${from_user.firstName} ${from_user.lastName}`.trim(),
    },
  });
});

exports.startVideoCall = catchAsync(async (req, res) => {
  const from = req.user._id;
  const to = req.body.id;

  const to_user = await User.findById(to);
  const from_user = await User.findById(from);

  const new_video_call = await VideoCall.create({
    participants: [from, to],
    from,
    to,
    status: "Ongoing",
  });

  res.status(200).json({
    data: {
      from: to_user,
      from_user,
      roomID: new_video_call._id,
      streamID: from,
      recipientID: to,
      userID: from,
      userName: `${from_user.firstName} ${from_user.lastName}`.trim(),
    },
  });
});

exports.getCallLogs = catchAsync(async (req, res) => {
  const user_id = req.user._id;

  const call_logs = [];

  const audio_calls = await AudioCall.find({
    participants: { $all: [user_id] },
  }).populate("from to");

  const video_calls = await VideoCall.find({
    participants: { $all: [user_id] },
  }).populate("from to");

  console.log(audio_calls, video_calls);

  for (let elm of audio_calls) {
    const missed = elm.verdict !== "Accepted";
    if (elm.from._id.toString() === user_id.toString()) {
      const other_user = elm.to;

      // outgoing
      call_logs.push({
        id: elm._id,
        img: getPublicUrl(other_user.avatar),
        name: other_user.firstName,
        online: other_user.status === "Online",
        incoming: false,
        missed,
      });
    } else {
      // incoming
      const other_user = elm.from;

      // outgoing
      call_logs.push({
        id: elm._id,
        img: getPublicUrl(other_user.avatar),
        name: other_user.firstName,
        online: other_user.status === "Online",
        incoming: true,
        missed,
      });
    }
  }

  for (let element of video_calls) {
    const missed = element.verdict !== "Accepted";
    if (element.from._id.toString() === user_id.toString()) {
      const other_user = element.to;

      // outgoing
      call_logs.push({
        id: element._id,
        img: getPublicUrl(other_user.avatar),
        name: other_user.firstName,
        online: other_user.status === "Online",
        incoming: false,
        missed,
      });
    } else {
      // incoming
      const other_user = element.from;

      // outgoing
      call_logs.push({
        id: element._id,
        img: getPublicUrl(other_user.avatar),
        name: other_user.firstName,
        online: other_user.status === "Online",
        incoming: true,
        missed,
      });
    }
  }

  res.status(200).json({
    status: "success",
    message: "Call Logs Found successfully!",
    data: call_logs,
  });
});
