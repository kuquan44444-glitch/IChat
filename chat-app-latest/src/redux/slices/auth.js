import { createSlice } from "@reduxjs/toolkit";

import axios from "../../utils/axios";
import { showSnackbar } from "./app";

const STORAGE_KEYS = {
  token: "token",
  userId: "user_id",
};

const getStoredValue = (key) => window.localStorage.getItem(key);
const getErrorMessage = (error) => error?.message || error || "Something went wrong";

const persistSession = ({ token, userId }) => {
  if (token) {
    window.localStorage.setItem(STORAGE_KEYS.token, token);
  }

  if (userId) {
    window.localStorage.setItem(STORAGE_KEYS.userId, userId);
  }
};

const clearSession = () => {
  window.localStorage.removeItem(STORAGE_KEYS.token);
  window.localStorage.removeItem(STORAGE_KEYS.userId);
};

const initialToken = getStoredValue(STORAGE_KEYS.token) || "";
const initialUserId = getStoredValue(STORAGE_KEYS.userId) || "";

const initialState = {
  isLoggedIn: Boolean(initialToken && initialUserId),
  token: initialToken,
  isLoading: false,
  user: null,
  user_id: initialUserId,
  email: "",
  error: false,
};

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    updateIsLoading(state, action) {
      state.error = action.payload.error;
      state.isLoading = action.payload.isLoading;
    },
    logIn(state, action) {
      state.isLoggedIn = action.payload.isLoggedIn;
      state.token = action.payload.token;
      state.user_id = action.payload.user_id;
    },
    signOut(state) {
      state.isLoggedIn = false;
      state.token = "";
      state.user_id = "";
    },
    updateRegisterEmail(state, action) {
      state.email = action.payload.email;
    },
  },
});

export default slice.reducer;

export function NewPassword(formValues) {
  return async (dispatch) => {
    dispatch(slice.actions.updateIsLoading({ isLoading: true, error: false }));

    try {
      const response = await axios.post("/auth/reset-password", {
        ...formValues,
      });

      persistSession({
        token: response.data.token,
        userId: response.data.user_id,
      });

      dispatch(
        slice.actions.logIn({
          isLoggedIn: true,
          token: response.data.token,
          user_id: response.data.user_id,
        })
      );
      dispatch(showSnackbar({ severity: "success", message: response.data.message }));
      dispatch(slice.actions.updateIsLoading({ isLoading: false, error: false }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
      dispatch(slice.actions.updateIsLoading({ isLoading: false, error: true }));
    }
  };
}

export function ForgotPassword(formValues) {
  return async (dispatch) => {
    dispatch(slice.actions.updateIsLoading({ isLoading: true, error: false }));

    try {
      const response = await axios.post("/auth/forgot-password", {
        ...formValues,
      });

      dispatch(showSnackbar({ severity: "success", message: response.data.message }));
      dispatch(slice.actions.updateIsLoading({ isLoading: false, error: false }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
      dispatch(slice.actions.updateIsLoading({ isLoading: false, error: true }));
    }
  };
}

export function LoginUser(formValues) {
  return async (dispatch) => {
    dispatch(slice.actions.updateIsLoading({ isLoading: true, error: false }));

    try {
      const response = await axios.post("/auth/login", {
        ...formValues,
      });

      persistSession({
        token: response.data.token,
        userId: response.data.user_id,
      });

      dispatch(
        slice.actions.logIn({
          isLoggedIn: true,
          token: response.data.token,
          user_id: response.data.user_id,
        })
      );
      dispatch(showSnackbar({ severity: "success", message: response.data.message }));
      dispatch(slice.actions.updateIsLoading({ isLoading: false, error: false }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
      dispatch(slice.actions.updateIsLoading({ isLoading: false, error: true }));
    }
  };
}

export function LogoutUser() {
  return async (dispatch) => {
    clearSession();
    dispatch(slice.actions.signOut());
  };
}

export function RegisterUser(formValues) {
  return async (dispatch) => {
    dispatch(slice.actions.updateIsLoading({ isLoading: true, error: false }));

    try {
      const response = await axios.post("/auth/register", {
        ...formValues,
      });

      dispatch(slice.actions.updateRegisterEmail({ email: formValues.email }));
      dispatch(showSnackbar({ severity: "success", message: response.data.message }));

      if (response.data.token && response.data.user_id) {
        persistSession({
          token: response.data.token,
          userId: response.data.user_id,
        });

        dispatch(
          slice.actions.logIn({
            isLoggedIn: true,
            token: response.data.token,
            user_id: response.data.user_id,
          })
        );
      } else if (response.data.requiresEmailVerification) {
        window.location.href = "/auth/verify";
      }

      dispatch(slice.actions.updateIsLoading({ isLoading: false, error: false }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
      dispatch(slice.actions.updateIsLoading({ error: true, isLoading: false }));
    }
  };
}

export function VerifyEmail(formValues) {
  return async (dispatch) => {
    dispatch(slice.actions.updateIsLoading({ isLoading: true, error: false }));

    try {
      const response = await axios.post("/auth/verify", {
        ...formValues,
      });

      persistSession({
        token: response.data.token,
        userId: response.data.user_id,
      });

      dispatch(slice.actions.updateRegisterEmail({ email: "" }));
      dispatch(
        slice.actions.logIn({
          isLoggedIn: true,
          token: response.data.token,
          user_id: response.data.user_id,
        })
      );
      dispatch(showSnackbar({ severity: "success", message: response.data.message }));
      dispatch(slice.actions.updateIsLoading({ isLoading: false, error: false }));
    } catch (error) {
      dispatch(showSnackbar({ severity: "error", message: getErrorMessage(error) }));
      dispatch(slice.actions.updateIsLoading({ error: true, isLoading: false }));
    }
  };
}
