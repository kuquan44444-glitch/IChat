import { createSlice } from "@reduxjs/toolkit";
import { getFileUrl } from "../../utils/file";

const user_id = window.localStorage.getItem("user_id");

const initialState = {
  direct_chat: {
    conversations: [],
    current_conversation: null,
    current_messages: [],
  },
  group_chat: {},
};

const slice = createSlice({
  name: "conversation",
  initialState,
  reducers: {
    fetchDirectConversations(state, action) {
      const list = action.payload.conversations.map((el) => {
        const user = el.participants.find(
          (elm) => elm._id.toString() !== user_id
        );
        return {
          id: el._id,
          user_id: user?._id,
          name: `${user?.firstName} ${user?.lastName}`,
          online: user?.status === "Online",
          img: getFileUrl(user?.avatar),
          msg: el.lastMessage || "",
          time: "9:36",
          unread: 0,
          pinned: false,
          about: user?.about,
          typing: false,
        };
      });

      state.direct_chat.conversations = list;
    },
    updateDirectConversation(state, action) {
      const this_conversation = action.payload.conversation;
      state.direct_chat.conversations = state.direct_chat.conversations.map(
        (el) => {
          if (el?.id !== this_conversation._id) {
            return el;
          } else {
            const user = this_conversation.participants.find(
              (elm) => elm._id.toString() !== user_id
            );
            return {
              id: this_conversation._id,
              user_id: user?._id,
              name: `${user?.firstName} ${user?.lastName}`,
              online: user?.status === "Online",
              img: getFileUrl(user?.avatar),
              msg: this_conversation.lastMessage || "",
              time: "9:36",
              unread: 0,
              pinned: false,
              about: user?.about,
              typing: false,
            };
          }
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
      state.direct_chat.conversations.push({
        id: this_conversation._id,
        user_id: user?._id,
        name: `${user?.firstName} ${user?.lastName}`,
        online: user?.status === "Online",
        img: getFileUrl(user?.avatar),
        msg: this_conversation.lastMessage || "",
        time: "9:36",
        unread: 0,
        pinned: false,
        about: user?.about,
        typing: false,
      });
    },
    setCurrentConversation(state, action) {
      state.direct_chat.current_conversation = action.payload;
    },
    fetchCurrentMessages(state, action) {
      const messages = action.payload.messages;
      const formatted_messages = messages.map((el) => ({
        id: el._id,
        type: "msg",
        subtype: el.type,
        message: el.text,
        file: el.file,
        incoming: el.to?.toString() === user_id,
        outgoing: el.from?.toString() === user_id,
      }));
      state.direct_chat.current_messages = formatted_messages;
    },
    addDirectMessage(state, action) {
      state.direct_chat.current_messages.push(action.payload.message);
    },
    setUserTyping(state, action) {
      state.direct_chat.conversations = state.direct_chat.conversations.map(
        (conversation) =>
          conversation.id === action.payload.conversation_id
            ? { ...conversation, typing: action.payload.isTyping }
            : conversation
      );
    },
    setUserStatus(state, action) {
      state.direct_chat.conversations = state.direct_chat.conversations.map(
        (conversation) =>
          conversation.user_id === action.payload.user_id
            ? {
                ...conversation,
                online: action.payload.status === "Online",
              }
            : conversation
      );
    },
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

export const SetUserTyping = ({ conversation_id, isTyping }) => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.setUserTyping({ conversation_id, isTyping }));
  };
};

export const SetUserStatus = ({ user_id, status }) => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.setUserStatus({ user_id, status }));
  };
};
