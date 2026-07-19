import { createSlice } from "@reduxjs/toolkit";
import { AWS_S3_REGION, S3_BUCKET_NAME } from "../../config";

const user_id = window.localStorage.getItem("user_id");

const initialState = {
  direct_chat: {
    conversations: [],
    current_conversation: null,
    current_messages: [],
  },
  group_chat: {},
};

const buildS3Url = (fileKey) => {
  if (!fileKey) {
    return "";
  }

  if (fileKey.startsWith("http://") || fileKey.startsWith("https://")) {
    return fileKey;
  }

  return `https://${S3_BUCKET_NAME}.s3.${AWS_S3_REGION}.amazonaws.com/${fileKey}`;
};

const formatConversation = (conversation) => {
  const user = conversation.participants.find(
    (participant) => participant._id.toString() !== user_id
  );
  const lastMessage = conversation.messages?.slice(-1)[0];

  return {
    id: conversation._id,
    user_id: user?._id,
    name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
    online: user?.status === "Online",
    img: buildS3Url(user?.avatar),
    msg: lastMessage?.text || "Start chatting",
    time: "9:36",
    unread: 0,
    pinned: false,
    about: user?.about || "",
  };
};

const formatMessage = (message) => ({
  id: message._id,
  type: "msg",
  subtype:
    message.type === "Media"
      ? "img"
      : message.type === "Document"
      ? "doc"
      : message.type === "Link"
      ? "Link"
      : "text",
  message: message.text,
  img: buildS3Url(message.file),
  file: buildS3Url(message.file),
  incoming: message.to === user_id,
  outgoing: message.from === user_id,
});

const slice = createSlice({
  name: "conversation",
  initialState,
  reducers: {
    fetchDirectConversations(state, action) {
      state.direct_chat.conversations = action.payload.conversations.map(
        formatConversation
      );
    },
    updateDirectConversation(state, action) {
      const this_conversation = action.payload.conversation;
      state.direct_chat.conversations = state.direct_chat.conversations.map(
        (el) => {
          if (el?.id !== this_conversation._id) {
            return el;
          }

          return formatConversation(this_conversation);
        }
      );
    },
    addDirectConversation(state, action) {
      const this_conversation = action.payload.conversation;
      const user = this_conversation.participants.find(
        (elm) => elm._id.toString() !== user_id
      );
      state.direct_chat.conversations = state.direct_chat.conversations.filter(
        (el) => el?.id !== this_conversation._id
      );
      state.direct_chat.conversations.push(formatConversation(this_conversation));
    },
    setCurrentConversation(state, action) {
      state.direct_chat.current_conversation = action.payload;
    },
    fetchCurrentMessages(state, action) {
      state.direct_chat.current_messages = action.payload.messages.map(
        formatMessage
      );
    },
    addDirectMessage(state, action) {
      state.direct_chat.current_messages.push(action.payload.message);
    }
  },
});

// Reducer
export default slice.reducer;

// ----------------------------------------------------------------------

export const FetchDirectConversations = ({ conversations }) => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.fetchDirectConversations({ conversations }));
  };
};
export const AddDirectConversation = ({ conversation }) => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.addDirectConversation({ conversation }));
  };
};
export const UpdateDirectConversation = ({ conversation }) => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.updateDirectConversation({ conversation }));
  };
};

export const SetCurrentConversation = (current_conversation) => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.setCurrentConversation(current_conversation));
  };
};


export const FetchCurrentMessages = ({messages}) => {
  return async(dispatch, getState) => {
    dispatch(slice.actions.fetchCurrentMessages({messages}));
  }
}

export const AddDirectMessage = (message) => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.addDirectMessage({message}));
  }
}
