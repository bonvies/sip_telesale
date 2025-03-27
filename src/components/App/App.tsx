import { useState } from "react"
import styled from "@emotion/styled"
import { SessionState } from "sip.js"
import { useBonTalk } from "@/Provider/BonTalkProvider"
import { useView } from "@/Provider/ViewProvider"
import useUA from "@/hooks/useUA"
import KeyPad from "@/views/KeyPad"
import IncomingCall from "@/views/IncomingCall"
import Calling from "@/views/Calling"
import Video from "@/views/Video"
import { SessionName } from "@/entry/plugin"
import { useAudio } from "@/Provider/AudioProvider"

export default function App() {
  const bonTalk = useBonTalk()!
  const { view, setView, currentCallingTarget, setCurrentCallingTarget } = useView()
  const {
    audioCall,
    hangupCall,
    answerCall,
    rejectCall,
    setMute,
    setVideoTransport,
    setHold,
    blindTransfer,
    preAttendedTransfer,
    attendedTransfer,
    sendDTMF,
    setupLocalVideo,
    removeLocalVideo,
    setupRemoteVideo,
    removeRemoteVideo,
  } = useUA()
  const [tempCurrentCallingTarget, setTempCurrentCallingTarget] = useState<SessionName | "">("");

  const { startRingBackTone, stopRingBackTone } = useAudio()

  // TODO: need state?
  const currentSession = bonTalk.sessionManager.getSession(currentCallingTarget)

  const callTargetTitle = currentSession?.name || ""

  const handleCall = async (numbers: string, mode: "IN_CALL" | "CALL_VIDEO"  ) => {
    const inviter = await audioCall(numbers, "outgoing")

    setView(mode)
    startRingBackTone()
    setCurrentCallingTarget("outgoing")
    inviter!.stateChange.addListener((state: SessionState) => {
      stopRingBackTone()
      switch (state) {
        case SessionState.Terminated:
          setTimeout(() => {
            setView("KEY_PAD")
          }, 1000)
          setCurrentCallingTarget("")
          console.warn("inviter", state)
          break
      }
    })
  }

  const handleAccept = async () => {
    setCurrentCallingTarget("incoming")
    await answerCall()
  }

  const handleReject = async () => {
    setCurrentCallingTarget("")
    await rejectCall()
  }

  const handleHangClick = async () => {
    if (!currentCallingTarget) return
    setCurrentCallingTarget("")
    await hangupCall(currentCallingTarget)
  }

  const handleMuteClick = () => {
    if (!currentCallingTarget) return
    const currentSession = bonTalk.sessionManager.getSession(currentCallingTarget)
    setMute(!currentSession?.isMuted, currentCallingTarget)
  }

  const handleVideoClick = (isVideoEnabled: boolean) => {
    if (!currentCallingTarget) return
    setVideoTransport(isVideoEnabled, currentCallingTarget)
  }

  const handleHoldClick = () => {
    if (!currentCallingTarget) return
    const currentSession = bonTalk.sessionManager.getSession(currentCallingTarget)
    setHold(!currentSession?.isHold, currentCallingTarget)
  }

  const handleForwardClick = async (number: string) => {
    if (!currentCallingTarget) return
    if (currentCallingTarget === "attendedRefer") {
      // TODO
      await attendedTransfer("attendedRefer", "outgoing")
      return
    }

    await blindTransfer(currentCallingTarget, number)
  }

  const handlePreForwardSendCall = async (number: string) => {
    if (!currentCallingTarget) return

    const inviter = await preAttendedTransfer(currentCallingTarget, number)
    const prevCurrentCallingTarget = currentCallingTarget
    setTempCurrentCallingTarget(prevCurrentCallingTarget)
    setCurrentCallingTarget("attendedRefer")
    inviter!.stateChange.addListener((state: SessionState) => {
      switch (state) {
        case SessionState.Terminated:
          setCurrentCallingTarget(prevCurrentCallingTarget)
          setTempCurrentCallingTarget("")
          break
      }
    })
  }

  const handleDTMFClick = async (key: string) => {
    if (!currentCallingTarget) return
    await sendDTMF(key, currentCallingTarget)
  }
  
  return (
    <AppContainer>
      <Content>
        {view === "KEY_PAD" ? 
          <KeyPad onCall={handleCall} />
        : null}
        {view === "RECEIVED_CALL" ? <IncomingCall displayTitle={callTargetTitle} onAccept={handleAccept} onReject={handleReject} /> : null}
        {view === "IN_CALL" ? (
          <Calling
            key={currentCallingTarget}
            currentSessionName={currentCallingTarget}
            callTarget={callTargetTitle}
            prevTarget={tempCurrentCallingTarget}
            onHangClick={handleHangClick}
            onHoldClick={handleHoldClick}
            onMuteClick={handleMuteClick}
            onForwardClick={handleForwardClick}
            onPreForwardSendCall={handlePreForwardSendCall}
            onDTMFClick={handleDTMFClick}
          />
        ) : null}
        {view === "CALL_VIDEO" ? ( 
          <Video
            onVideoClick={handleVideoClick}
            onSetupLocalVideo={setupLocalVideo}
            onRemoveLocalVideo={removeLocalVideo}
            onSetupRemoteVideo={() => {
              if (currentCallingTarget) {
                setupRemoteVideo(currentCallingTarget as SessionName)
              }
            }}
            onRemoveRemoteVideo={removeRemoteVideo}
          />
        ) : null}
        <ContentFooter>
          <Logo />
        </ContentFooter>
      </Content>
    </AppContainer>
  )
}

const AppContainer = styled.div((props) => ({
  width: "360px",
  height: "656px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  backgroundColor: props.theme.colors.background.default,
  zIndex: "10000"
}))

const Content = styled.div({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  width: "100%",
  height: "100%",
})

const ContentFooter = styled.div({
  boxSizing: "border-box",
  width: "100%",
  height: "64px",
  backgroundColor: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
})

const Logo = styled.div({
  width: "48px",
  height: "32px",
  backgroundImage: "url(vite.svg)",
  backgroundSize: "cover",
  backgroundPosition: "center",
})
