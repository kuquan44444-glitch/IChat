import { faker } from "@faker-js/faker";
import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Slide,
  Stack,
} from "@mui/material";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ResetVideoCallQueue,
  UpdateVideoCallDialog,
} from "../../../redux/slices/videoCall";
import { socket } from "../../../socket";
import { getFileUrl } from "../../../utils/file";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const VideoCallNotification = ({ open, handleClose }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.app);
  const [call_details] = useSelector((state) => state.videoCall.call_queue);

  const handleAccept = () => {
    socket.emit("video_call_accepted", { ...call_details });
    dispatch(UpdateVideoCallDialog({ state: true }));
  };

  const handleDeny = () => {
    //
    socket.emit("video_call_denied", { ...call_details });
    dispatch(ResetVideoCallQueue());
    handleClose();
  };

  return (
    <>
      <Dialog
        open={open}
        TransitionComponent={Transition}
        keepMounted
        onClose={handleDeny}
        aria-describedby="alert-dialog-slide-description"
      >
        <DialogContent>
          <Stack direction="row" spacing={24} p={2}>
            <Stack>
              <Avatar
                sx={{ height: 100, width: 100 }}
                src={getFileUrl(call_details?.from_user?.avatar)}
              />
            </Stack>
            <Stack>
              <Avatar
                sx={{ height: 100, width: 100 }}
                src={getFileUrl(user?.avatar)}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAccept} variant="contained" color="success">
            Accept
          </Button>
          <Button onClick={handleDeny} variant="contained" color="error">
            Deny
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VideoCallNotification;
