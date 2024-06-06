import { useState } from "react"
import styled from "@emotion/styled"
import { SessionState } from "sip.js"

import { useBonTalk } from "@/Provider/BonTalkProvider"
import { useView } from "@/Provider/ViewProvider"
import useUA from "@/hooks/useUA"
import KeyPad from "@/views/KeyPad"
import IncomingCall from "@/views/IncomingCall"
import Calling from "@/views/Calling"
import { SessionName } from "@/entry/plugin"

export default function App() {
  const bonTalk = useBonTalk()!
  const { view, setView, currentCallingTarget, setCurrentCallingTarget } = useView()
  const {
    audioCall,
    hangupCall,
    answerCall,
    rejectCall,
    setMute,
    setHold,
    blindTransfer,
    preAttendedTransfer,
    attendedTransfer,
    sendDTMF,
  } = useUA()
  const [tempCurrentCallingTarget, setTempCurrentCallingTarget] = useState<SessionName | "">("")

  // TODO: need state?
  const currentSession = bonTalk.sessionManager.getSession(currentCallingTarget)

  const callTargetTitle = currentSession?.name || ""

  const handleCall = async (numbers: string) => {
    const inviter = await audioCall(numbers, "outgoing")
    setView("IN_CALL")
    setCurrentCallingTarget("outgoing")
    inviter!.stateChange.addListener((state: SessionState) => {
      switch (state) {
        case SessionState.Terminated:
          setView("KEY_PAD")
          setCurrentCallingTarget("")
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
        {view === "KEY_PAD" ? <KeyPad onCall={handleCall} /> : null}
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
