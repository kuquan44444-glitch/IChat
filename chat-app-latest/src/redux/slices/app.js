import { createSlice } from "@reduxjs/toolkit";
import axios from "../../utils/axios";
import uuidv4 from "../../utils/uuidv4";

const getErrorMessage = (error) => error?.message || error || "Something went wrong";
const getAuthConfig = (token) => ({
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
});

const initialState = {
  user: {},
  sideBar: {
    open: false,
    type: "CONTACT",
  },
  isLoggedIn: false,
  tab: 0,
  snackbar: {
    open: null,
    severity: null,
    message: null,
  },
  users: [],
  all_users: [],
  friends: [],
  friendRequests: [],
  chat_type: null,
  room_id: null,
  call_logs: [],
};

const slice = createSlice({
  name: "app",
  initialState,
  reducers: {
    fetchCallLogs(state, action) {
      state.call_logs = action.payload.call_logs;
    },
    fetchUser(state, action) {
      state.user = action.payload.user;
    },
    updateUser(state, action) {
      state.user = action.payload.user;
    },
    toggleSideBar(state) {
      state.sideBar.open = !state.sideBar.open;
    },
    updateSideBarType(state, action) {
      state.sideBar.type = action.payload.type;
    },
    updateTab(state, action) {
      state.tab = action.payload.tab;
    },
    openSnackBar(state, action) {
      state.snackbar.open = true;
      state.snackbar.severity = action.payload.severity;
      state.snackbar.message = action.payload.message;
    },
    closeSnackBar(state) {
      state.snackbar.open = false;
      state.snackbar.message = null;
    },
    updateUsers(state, action) {
      state.users = action.payload.users;
    },
    updateAllUsers(state, action) {
      state.all_users = action.payload.users;
    },
    updateFriends(state, action) {
      state.friends = action.payload.friends;
    },
    updateFriendRequests(state, action) {
      state.friendRequests = action.payload.requests;
    },
    selectConversation(state, action) {
      state.chat_type = "individual";
      state.room_id = action.payload.room_id;
    },
  },
});

export default slice.reducer;

export const closeSnackBar = () => async (dispatch) => {
  dispatch(slice.actions.closeSnackBar());
};

export const showSnackbar =
  ({ severity, message }) =>
  async (dispatch) => {
    dispatch(
      slice.actions.openSnackBar({
        message,
        severity,
      })
    );

    setTimeout(() => {
      dispatch(slice.actions.closeSnackBar());
    }, 4000);
  };

export function ToggleSidebar() {
  return async (dispatch) => {
    dispatch(slice.actions.toggleSideBar());
  };
}

export function UpdateSidebarType(type) {
  return async (dispatch) => {
    dispatch(slice.actions.updateSideBarType({ type }));
  };
}

export function UpdateTab(tab) {
  return async (dispatch) => {
    dispatch(slice.actions.updateTab(tab));
  };
}

export function FetchUsers() {
  return async (dispatch, getState) => {
    try {
      const response = await axios.get(
        "/user/get-users",
        getAuthConfig(getState().auth.token)
      );
      dispatch(slice.actions.updateUsers({ users: response.data.data || [] }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
    }
  };
}

export function FetchAllUsers() {
  return async (dispatch, getState) => {
    try {
      const response = await axios.get(
        "/user/get-all-verified-users",
        getAuthConfig(getState().auth.token)
      );
      dispatch(slice.actions.updateAllUsers({ users: response.data.data || [] }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
    }
  };
}

export function FetchFriends() {
  return async (dispatch, getState) => {
    try {
      const response = await axios.get(
        "/user/get-friends",
        getAuthConfig(getState().auth.token)
      );
      dispatch(slice.actions.updateFriends({ friends: response.data.data || [] }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
    }
  };
}

export function FetchFriendRequests() {
  return async (dispatch, getState) => {
    try {
      const response = await axios.get(
        "/user/get-requests",
        getAuthConfig(getState().auth.token)
      );
      dispatch(
        slice.actions.updateFriendRequests({ requests: response.data.data || [] })
      );
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
    }
  };
}

export const SelectConversation = ({ room_id }) => {
  return async (dispatch) => {
    dispatch(slice.actions.selectConversation({ room_id }));
  };
};

export const FetchCallLogs = () => {
  return async (dispatch, getState) => {
    try {
      const response = await axios.get(
        "/user/get-call-logs",
        getAuthConfig(getState().auth.token)
      );
      dispatch(slice.actions.fetchCallLogs({ call_logs: response.data.data || [] }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
    }
  };
};

export const FetchUserProfile = () => {
  return async (dispatch, getState) => {
    try {
      const response = await axios.get(
        "/user/get-me",
        getAuthConfig(getState().auth.token)
      );
      dispatch(slice.actions.fetchUser({ user: response.data.data || {} }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
    }
  };
};

export const UpdateUserProfile = (formValues) => {
  return async (dispatch, getState) => {
    try {
      const token = getState().auth.token;
      const payload = {
        firstName: formValues.firstName,
        about: formValues.about,
      };

      if (formValues.avatar instanceof File) {
        const key = `avatars/${uuidv4()}`;
        const uploadResponse = await axios.post(
          "/user/avatar-upload-url",
          {
            key,
            contentType: formValues.avatar.type,
          },
          getAuthConfig(token)
        );

        await fetch(uploadResponse.data.data.uploadUrl, {
          method: "PUT",
          body: formValues.avatar,
          headers: {
            "Content-Type": formValues.avatar.type,
          },
        });

        payload.avatar = key;
      }

      const response = await axios.patch(
        "/user/update-me",
        payload,
        getAuthConfig(token)
      );

      dispatch(slice.actions.updateUser({ user: response.data.data }));
      dispatch(showSnackbar({ severity: "success", message: response.data.message }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
    }
  };
};
