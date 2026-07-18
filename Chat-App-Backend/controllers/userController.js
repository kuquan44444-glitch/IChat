const AWS = require("aws-sdk");

const AudioCall = require("../models/audioCall");
const FriendRequest = require("../models/friendRequest");
const User = require("../models/user");
const VideoCall = require("../models/videoCall");
const catchAsync = require("../utils/catchAsync");
const filterObj = require("../utils/filterObj");

const { generateToken04 } = require("./zegoServerAssistant");

const appID = process.env.ZEGO_APP_ID;
const serverSecret = process.env.ZEGO_SERVER_SECRET;

const createS3Client = () =>
  new AWS.S3({
    signatureVersion: "v4",
    region: process.env.AWS_S3_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select(
    "_id firstName lastName email avatar about verified friends status"
  );

  res.status(200).json({
    status: "success",
    data: user,
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
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
  }).select("_id firstName lastName email avatar about verified friends status");

  res.status(200).json({
    status: "success",
    data: userDoc,
    message: "User Updated successfully",
  });
});

exports.getUsers = catchAsync(async (req, res, next) => {
  const currentUser = await User.findById(req.user._id).select("friends");
  const requests = await FriendRequest.find({
    $or: [{ sender: req.user._id }, { recipient: req.user._id }],
  }).select("sender recipient");

  const excludedIds = new Set([req.user._id.toString()]);

  currentUser.friends.forEach((friendId) => excludedIds.add(friendId.toString()));
  requests.forEach((request) => {
    excludedIds.add(request.sender.toString());
    excludedIds.add(request.recipient.toString());
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

exports.getAllVerifiedUsers = catchAsync(async (req, res, next) => {
  const users = await User.find({
    verified: true,
    _id: { $ne: req.user._id },
  }).select("_id firstName lastName avatar about status");

  res.status(200).json({
    status: "success",
    data: users,
    message: "Users found successfully!",
  });
});

exports.getRequests = catchAsync(async (req, res, next) => {
  const requests = await FriendRequest.find({ recipient: req.user._id }).populate(
    "sender",
    "_id firstName lastName avatar about status"
  );

  res.status(200).json({
    status: "success",
    data: requests,
    message: "Requests found successfully!",
  });
});

exports.getFriends = catchAsync(async (req, res, next) => {
  const currentUser = await User.findById(req.user._id).populate(
    "friends",
    "_id firstName lastName avatar about status"
  );

  res.status(200).json({
    status: "success",
    data: currentUser?.friends || [],
    message: "Friends found successfully!",
  });
});

exports.createAvatarUploadUrl = catchAsync(async (req, res, next) => {
  const { key, contentType } = req.body;

  if (!key || !contentType) {
    return res.status(400).json({
      status: "error",
      message: "Both key and contentType are required.",
    });
  }

  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  if (
    !bucketName ||
    !process.env.AWS_S3_REGION ||
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY
  ) {
    return res.status(500).json({
      status: "error",
      message: "S3 upload is not configured on the server.",
    });
  }

  const s3 = createS3Client();
  const uploadUrl = await s3.getSignedUrlPromise("putObject", {
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    Expires: 60,
  });

  res.status(200).json({
    status: "success",
    data: {
      key,
      uploadUrl,
    },
  });
});

exports.generateZegoToken = catchAsync(async (req, res, next) => {
  const { userId, room_id: roomId } = req.body;
  const effectiveTimeInSeconds = 3600;
  const payload = JSON.stringify({
    room_id: roomId,
    privilege: {
      1: 1,
      2: 1,
    },
    stream_id_list: null,
  });

  const token = generateToken04(
    Number(appID),
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
});

exports.startAudioCall = catchAsync(async (req, res, next) => {
  const from = req.user._id;
  const to = req.body.id;
  const toUser = await User.findById(to);

  const newAudioCall = await AudioCall.create({
    participants: [from, to],
    from,
    to,
    status: "Ongoing",
  });

  res.status(200).json({
    data: {
      from: toUser,
      from_user: toUser,
      roomID: newAudioCall._id,
      streamID: to,
      userID: from,
      userName: from.toString(),
      to,
    },
  });
});

exports.startVideoCall = catchAsync(async (req, res, next) => {
  const from = req.user._id;
  const to = req.body.id;
  const toUser = await User.findById(to);

  const newVideoCall = await VideoCall.create({
    participants: [from, to],
    from,
    to,
    status: "Ongoing",
  });

  res.status(200).json({
    data: {
      from: toUser,
      from_user: toUser,
      roomID: newVideoCall._id,
      streamID: to,
      userID: from,
      userName: from.toString(),
      to,
    },
  });
});

exports.getCallLogs = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const callLogs = [];

  const [audioCalls, videoCalls] = await Promise.all([
    AudioCall.find({
      participants: { $all: [userId] },
    }).populate("from to", "_id firstName lastName avatar status"),
    VideoCall.find({
      participants: { $all: [userId] },
    }).populate("from to", "_id firstName lastName avatar status"),
  ]);

  for (const call of audioCalls) {
    const missed = call.verdict !== "Accepted";

    if (call.from._id.toString() === userId.toString()) {
      callLogs.push({
        id: call._id,
        img: call.to.avatar,
        name: call.to.firstName,
        online: call.to.status === "Online",
        incoming: false,
        missed,
      });
    } else {
      callLogs.push({
        id: call._id,
        img: call.from.avatar,
        name: call.from.firstName,
        online: call.from.status === "Online",
        incoming: true,
        missed,
      });
    }
  }

  for (const call of videoCalls) {
    const missed = call.verdict !== "Accepted";

    if (call.from._id.toString() === userId.toString()) {
      callLogs.push({
        id: call._id,
        img: call.to.avatar,
        name: call.to.firstName,
        online: call.to.status === "Online",
        incoming: false,
        missed,
      });
    } else {
      callLogs.push({
        id: call._id,
        img: call.from.avatar,
        name: call.from.firstName,
        online: call.from.status === "Online",
        incoming: true,
        missed,
      });
    }
  }

  res.status(200).json({
    status: "success",
    message: "Call Logs Found successfully!",
    data: callLogs,
  });
});
