import React, { useEffect } from "react";
import { Stack } from "@mui/material";
import { Navigate, Outlet } from "react-router-dom";
import useResponsive from "../../hooks/useResponsive";
import SideNav from "./SideNav";
import { useDispatch, useSelector } from "react-redux";
import { FetchUserProfile, SelectConversation, showSnackbar } from "../../redux/slices/app";
import { socket, connectSocket } from "../../socket";
import {
  UpdateDirectConversation,
  AddDirectConversation,
  AddDirectMessage,
} from "../../redux/slices/conversation";
import AudioCallNotification from "../../sections/Dashboard/Audio/AudioCallNotification";
import VideoCallNotification from "../../sections/Dashboard/video/VideoCallNotification";
import {
  PushToAudioCallQueue,
  UpdateAudioCallDialog,
} from "../../redux/slices/audioCall";
import AudioCallDialog from "../../sections/Dashboard/Audio/AudioCallDialog";
import VideoCallDialog from "../../sections/Dashboard/video/VideoCallDialog";
import { PushToVideoCallQueue, UpdateVideoCallDialog } from "../../redux/slices/videoCall";

const DashboardLayout = () => {
  const isDesktop = useResponsive("up", "md");
  const dispatch = useDispatch();
  const {user_id} = useSelector((state) => state.auth);
  const { open_audio_notification_dialog, open_audio_dialog } = useSelector(
    (state) => state.audioCall
  );
  const { open_video_notification_dialog, open_video_dialog } = useSelector(
    (state) => state.videoCall
  );
  const { isLoggedIn } = useSelector((state) => state.auth);
  const { conversations, current_conversation } = useSelector(
    (state) => state.conversation.direct_chat
  );

  useEffect(() => {
    if (isLoggedIn) {
      dispatch(FetchUserProfile());
    }
  }, [dispatch, isLoggedIn]);

  const handleCloseAudioDialog = () => {
    dispatch(UpdateAudioCallDialog({ state: false }));
  };
  const handleCloseVideoDialog = () => {
    dispatch(UpdateVideoCallDialog({ state: false }));
  };

  useEffect(() => {
    if (!isLoggedIn || !user_id) {
      return undefined;
    }

    const activeSocket = connectSocket(user_id);

    const handleAudioNotification = (data) => {
      dispatch(PushToAudioCallQueue(data));
    };

    const handleVideoNotification = (data) => {
      dispatch(PushToVideoCallQueue(data));
    };

    const handleNewMessage = (data) => {
      const message = data.message;
      if (current_conversation?.id === data.conversation_id) {
        dispatch(
          AddDirectMessage({
            id: message._id,
            type: "msg",
            subtype: message.type,
            message: message.text,
            incoming: message.to === user_id,
            outgoing: message.from === user_id,
          })
        );
      }
    };

    const handleStartChat = (data) => {
      const existing_conversation = conversations.find((el) => el?.id === data._id);
      if (existing_conversation) {
        dispatch(UpdateDirectConversation({ conversation: data }));
      } else {
        dispatch(AddDirectConversation({ conversation: data }));
      }
      dispatch(SelectConversation({ room_id: data._id }));
    };

    const handleNewFriendRequest = () => {
      dispatch(
        showSnackbar({
          severity: "success",
          message: "New friend request received",
        })
      );
    };

    const handleRequestAccepted = () => {
      dispatch(
        showSnackbar({
          severity: "success",
          message: "Friend Request Accepted",
        })
      );
    };

    const handleRequestSent = (data) => {
      dispatch(showSnackbar({ severity: "success", message: data.message }));
    };

    activeSocket.off("audio_call_notification", handleAudioNotification);
    activeSocket.off("video_call_notification", handleVideoNotification);
    activeSocket.off("new_message", handleNewMessage);
    activeSocket.off("start_chat", handleStartChat);
    activeSocket.off("new_friend_request", handleNewFriendRequest);
    activeSocket.off("request_accepted", handleRequestAccepted);
    activeSocket.off("request_sent", handleRequestSent);

    activeSocket.on("audio_call_notification", handleAudioNotification);
    activeSocket.on("video_call_notification", handleVideoNotification);
    activeSocket.on("new_message", handleNewMessage);
    activeSocket.on("start_chat", handleStartChat);
    activeSocket.on("new_friend_request", handleNewFriendRequest);
    activeSocket.on("request_accepted", handleRequestAccepted);
    activeSocket.on("request_sent", handleRequestSent);

    return () => {
      activeSocket.off("audio_call_notification", handleAudioNotification);
      activeSocket.off("video_call_notification", handleVideoNotification);
      activeSocket.off("new_message", handleNewMessage);
      activeSocket.off("start_chat", handleStartChat);
      activeSocket.off("new_friend_request", handleNewFriendRequest);
      activeSocket.off("request_accepted", handleRequestAccepted);
      activeSocket.off("request_sent", handleRequestSent);
    };
  }, [dispatch, isLoggedIn, user_id, current_conversation?.id, conversations]);

  if (!isLoggedIn) {
    return <Navigate to={"/auth/login"} />;
  }

  return (
    <>
      <Stack direction="row">
        {isDesktop && (
          // SideBar
          <SideNav />
        )}

        <Outlet />
      </Stack>
      {open_audio_notification_dialog && (
        <AudioCallNotification open={open_audio_notification_dialog} />
      )}
      {open_audio_dialog && (
        <AudioCallDialog
          open={open_audio_dialog}
          handleClose={handleCloseAudioDialog}
        />
      )}
      {open_video_notification_dialog && (
        <VideoCallNotification open={open_video_notification_dialog} />
      )}
      {open_video_dialog && (
        <VideoCallDialog
          open={open_video_dialog}
          handleClose={handleCloseVideoDialog}
        />
      )}
    </>
  );
};

export default DashboardLayout;
