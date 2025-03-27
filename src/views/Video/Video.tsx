import { useEffect, useState } from "react"
import styled from "@emotion/styled"
import { useBonTalk } from "@/Provider/BonTalkProvider"
import { useView } from "@/Provider/ViewProvider"
import ActionPad, { type ActionButtonType } from "@/components/ActionPad"
import Header from "@/components/Header"

type CallingProps = {
  onVideoClick: (isVideoEnabled: boolean) => void
  onSetupLocalVideo: () => void
  onRemoveLocalVideo: () => void
  onSetupRemoteVideo: () => void
  onRemoveRemoteVideo: () => void
}

export default function Video(props: CallingProps) {
  const bonTalk = useBonTalk()!
  const { setView, currentCallingTarget, setCurrentCallingTarget } = useView()
  const [isLocalVideoLarge, setIsLocalVideoLarge] = useState(false)

  const handleVideoClick = () => {
    if (!currentCallingTarget) return
    const currentSession = bonTalk.sessionManager.getSession(currentCallingTarget)
    if (currentSession!.isVideoEnabled) {
      props.onRemoveLocalVideo();
      props.onVideoClick(false);
    } else {
      props.onSetupLocalVideo();
      props.onVideoClick(true);
    }
    console.log("currentSession", currentSession!.isVideoEnabled)
  }

  const handleToInCallPad = async () => {
    setView("IN_CALL")
  }

  const handleHangupClick = async () => {
    if (!currentCallingTarget) return
    setCurrentCallingTarget("")
    props.onRemoveLocalVideo();
    props.onRemoveRemoteVideo();
    await bonTalk.hangupCall(currentCallingTarget)
  }

  const handleActionPress = (action: ActionButtonType) => {
    switch (action) {
      case "CALL_VIDEO":
        handleVideoClick()
        break
      case "HANG":
        handleHangupClick()
        break
      case "BACK":
        handleToInCallPad()
        break
      default:
        console.log(action)
        // DO NOT ACCEPT OTHER STUFF
        break
    }
  }

  const toggleVideoSize = () => {
    setIsLocalVideoLarge(!isLocalVideoLarge)
  }

  useEffect(() => {
    // 設定視訊流 設置
    props.onSetupLocalVideo();
    props.onSetupRemoteVideo();
    // 視訊流傳遞 開啟
    props.onVideoClick(true);
    return () => {
      // 設定視訊流 移除
      props.onVideoClick(false);
    }
  }, []);

  return (
    <>
      <Header />
      <VideoContainer>
        <RemoteVideo
          id={bonTalk!.remoteVideoElementId}
          large={!isLocalVideoLarge}
          onClick={toggleVideoSize}
          autoPlay
          playsInline
          muted
        ></RemoteVideo>
        <LocalVideo
          id={bonTalk!.localVideoElementId}
          large={isLocalVideoLarge}
          onClick={toggleVideoSize}
          autoPlay
          playsInline
          muted
        ></LocalVideo>
        <ActionPadContainer>
          <ActionPad actionType="VIDEO" onButtonClick={handleActionPress} />
        </ActionPadContainer>
      </VideoContainer>
    </>
  )
}

const VideoContainer = styled.div({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  backgroundColor: "#000",
})

const VideoElement = styled.video<{ large: boolean }>(({ large }) => ({
  position: large ? "static" : "absolute",
  width: large ? "100%" : "100px",
  height: large ? "100%" : "150px",
  objectFit: "cover",
  borderRadius: large ? "0" : "8px",
  bottom: large ? "auto" : "80px",
  right: large ? "auto" : "16px",
  cursor: "pointer",
}))

const RemoteVideo = styled(VideoElement)({})

const LocalVideo = styled(VideoElement)({})

const ActionPadContainer = styled.div({
  position: "absolute",
  bottom: "16px",
  width: "100%",
  display: "flex",
  justifyContent: "center",
  padding: "0 16px",
})