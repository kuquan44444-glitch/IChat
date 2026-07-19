import React, { useEffect } from "react";
import { Stack } from "@mui/material";
import { Navigate, Outlet } from "react-router-dom";
import useResponsive from "../../hooks/useResponsive";
import SideNav from "./SideNav";
import { useDispatch, useSelector } from "react-redux";
import {
  FetchFriendRequests,
  FetchFriends,
  FetchUserProfile,
  FetchUsers,
  SelectConversation,
  showSnackbar,
} from "../../redux/slices/app";
import { socket, connectSocket } from "../../socket";
import {
  UpdateDirectConversation,
  AddDirectConversation,
  AddDirectMessage,
  SetUserStatus,
  SetUserTyping,
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

    activeSocket.off("audio_call_notification");
    activeSocket.off("video_call_notification");
    activeSocket.off("new_message");
    activeSocket.off("start_chat");
    activeSocket.off("new_friend_request");
    activeSocket.off("request_accepted");
    activeSocket.off("request_sent");
    activeSocket.off("typing");
    activeSocket.off("stop_typing");
    activeSocket.off("user_status_changed");
    activeSocket.off("new_notification");

    activeSocket.on("audio_call_notification", (data) => {
        // TODO => dispatch an action to add this in call_queue
        dispatch(PushToAudioCallQueue(data));
    });
      
    activeSocket.on("video_call_notification", (data) => {
        // TODO => dispatch an action to add this in call_queue
        dispatch(PushToVideoCallQueue(data));
    });

    activeSocket.on("new_message", (data) => {
        const message = data.message;
        // check if msg we got is from currently selected conversation
        if (current_conversation?.id === data.conversation_id) {
          dispatch(
            AddDirectMessage({
              id: message._id,
              type: "msg",
              subtype: message.type,
              message: message.text,
              file: message.file,
              incoming: message.to?.toString() === user_id,
              outgoing: message.from?.toString() === user_id,
            })
          );
        }
    });

    activeSocket.on("start_chat", (data) => {
        // add / update to conversation list
        const existing_conversation = conversations.find(
          (el) => el?.id === data._id
        );
        if (existing_conversation) {
          // update direct conversation
          dispatch(UpdateDirectConversation({ conversation: data }));
        } else {
          // add direct conversation
          dispatch(AddDirectConversation({ conversation: data }));
        }
        dispatch(SelectConversation({ room_id: data._id }));
    });

    activeSocket.on("new_friend_request", (data) => {
        dispatch(
          showSnackbar({
            severity: "success",
            message: "New friend request received",
          })
        );
        dispatch(FetchFriendRequests());
        dispatch(FetchUsers());
    });

    activeSocket.on("request_accepted", (data) => {
        dispatch(
          showSnackbar({
            severity: "success",
            message: "Friend Request Accepted",
          })
        );
        dispatch(FetchFriendRequests());
        dispatch(FetchFriends());
        dispatch(FetchUsers());
    });

    activeSocket.on("request_sent", (data) => {
        dispatch(showSnackbar({ severity: "success", message: data.message }));
        dispatch(FetchUsers());
    });

    activeSocket.on("typing", (data) => {
      dispatch(SetUserTyping({ conversation_id: data.conversation_id, isTyping: true }));
    });

    activeSocket.on("stop_typing", (data) => {
      dispatch(SetUserTyping({ conversation_id: data.conversation_id, isTyping: false }));
    });

    activeSocket.on("user_status_changed", (data) => {
      dispatch(SetUserStatus(data));
    });

    activeSocket.on("new_notification", (data) => {
      dispatch(
        showSnackbar({
          severity: "info",
          message: data.message || "New notification",
        })
      );
    });

    // Remove event listener on component unmount
    return () => {
      activeSocket?.off("new_friend_request");
      activeSocket?.off("request_accepted");
      activeSocket?.off("request_sent");
      activeSocket?.off("start_chat");
      activeSocket?.off("new_message");
      activeSocket?.off("audio_call_notification");
      activeSocket?.off("video_call_notification");
      activeSocket?.off("typing");
      activeSocket?.off("stop_typing");
      activeSocket?.off("user_status_changed");
      activeSocket?.off("new_notification");
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
