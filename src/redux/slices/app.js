import { createSlice } from "@reduxjs/toolkit";
import axios from "../../utils/axios";
import { getFileUrl } from "../../utils/file";
// ----------------------------------------------------------------------

const initialState = {
  user: {},
  sideBar: {
    open: false,
    type: "CONTACT", // can be CONTACT, STARRED, SHARED
  },
  isLoggedIn: true,
  tab: 0, // [0, 1, 2, 3]
  snackbar: {
    open: null,
    severity: null,
    message: null,
  },
  users: [], // all users of app who are not friends and not requested yet
  all_users: [],
  friends: [], // all friends
  friendRequests: [], // all friend requests
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
    // Toggle Sidebar
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
      console.log(action.payload);
      state.snackbar.open = true;
      state.snackbar.severity = action.payload.severity;
      state.snackbar.message = action.payload.message;
    },
    closeSnackBar(state) {
      console.log("This is getting executed");
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

// Reducer
export default slice.reducer;

// ----------------------------------------------------------------------

export const closeSnackBar = () => async (dispatch, getState) => {
  dispatch(slice.actions.closeSnackBar());
};

export const showSnackbar =
  ({ severity, message }) =>
  async (dispatch, getState) => {
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
  return async (dispatch, getState) => {
    dispatch(slice.actions.toggleSideBar());
  };
}
export function UpdateSidebarType(type) {
  return async (dispatch, getState) => {
    dispatch(slice.actions.updateSideBarType({ type }));
  };
}
export function UpdateTab(tab) {
  return async (dispatch, getState) => {
    dispatch(slice.actions.updateTab(tab));
  };
}

export function FetchUsers() {
  return async (dispatch, getState) => {
    axios
      .get("/user/get-users", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getState().auth.token}`,
        },
      })
      .then((response) => {
        dispatch(slice.actions.updateUsers({ users: response.data.data }));
      })
      .catch((error) => {
        dispatch(
          showSnackbar({
            severity: "error",
            message: error.message || "Failed to fetch users",
          })
        );
      });
  };
}
export function FetchAllUsers() {
  return async (dispatch, getState) => {
    axios
      .get("/user/get-all-verified-users", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getState().auth.token}`,
        },
      })
      .then((response) => {
        dispatch(slice.actions.updateAllUsers({ users: response.data.data }));
      })
      .catch((error) => {
        dispatch(
          showSnackbar({
            severity: "error",
            message: error.message || "Failed to fetch users",
          })
        );
      });
  };
}
export function FetchFriends() {
  return async (dispatch, getState) => {
    axios
      .get("/user/get-friends", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getState().auth.token}`,
        },
      })
      .then((response) => {
        dispatch(slice.actions.updateFriends({ friends: response.data.data }));
      })
      .catch((error) => {
        dispatch(
          showSnackbar({
            severity: "error",
            message: error.message || "Failed to fetch friends",
          })
        );
      });
  };
}
export function FetchFriendRequests() {
  return async (dispatch, getState) => {
    axios
      .get("/user/get-requests", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getState().auth.token}`,
        },
      })
      .then((response) => {
        dispatch(
          slice.actions.updateFriendRequests({ requests: response.data.data })
        );
      })
      .catch((error) => {
        dispatch(
          showSnackbar({
            severity: "error",
            message: error.message || "Failed to fetch friend requests",
          })
        );
      });
  };
}

export const SelectConversation = ({ room_id }) => {
  return async (dispatch, getState) => {
    dispatch(slice.actions.selectConversation({ room_id }));
  };
};

export const FetchCallLogs = () => {
  return async (dispatch, getState) => {
    axios
      .get("/user/get-call-logs", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getState().auth.token}`,
        },
      })
      .then((response) => {
        console.log(response);
        dispatch(slice.actions.fetchCallLogs({ call_logs: response.data.data }));
      })
      .catch((err) => {
        console.log(err);
      });
  };
};
export const FetchUserProfile = () => {
  return async (dispatch, getState) => {
    axios
      .get("/user/get-me", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getState().auth.token}`,
        },
      })
      .then((response) => {
        dispatch(slice.actions.fetchUser({ user: response.data.data }));
      })
      .catch((error) => {
        dispatch(
          showSnackbar({
            severity: "error",
            message: error.message || "Failed to fetch profile",
          })
        );
      });
  };
};
export const UpdateUserProfile = (formValues) => {
  return async (dispatch, getState) => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getState().auth.token}`,
    };

    let avatar = formValues.avatar;

    if (avatar instanceof File) {
      const uploadResponse = await axios.post(
        "/user/upload-url",
        {
          fileName: avatar.name,
          fileType: avatar.type,
          folder: "avatars",
        },
        { headers }
      );

      await fetch(uploadResponse.data.data.uploadUrl, {
        method: "PUT",
        body: avatar,
        headers: {
          "Content-Type": avatar.type,
        },
      });

      avatar = uploadResponse.data.data.fileUrl;
    } else {
      avatar = getFileUrl(avatar);
    }

    axios
      .patch(
        "/user/update-me",
        { ...formValues, avatar },
        {
          headers,
        }
      )
      .then((response) => {
        dispatch(slice.actions.updateUser({ user: response.data.data }));
        dispatch(
          showSnackbar({
            severity: "success",
            message: response.data.message,
          })
        );
      })
      .catch((error) => {
        dispatch(
          showSnackbar({
            severity: "error",
            message: error.message || "Failed to update profile",
          })
        );
      });
  };
};
