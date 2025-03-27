import { useEffect, useState } from "react"
import { Invitation, SessionState } from "sip.js"
import { useBonTalk } from "@/Provider/BonTalkProvider"
import BonTalk, { SessionName } from "@/entry/plugin"
import { useAudio } from "@/Provider/AudioProvider"
import { useView } from "@/Provider/ViewProvider"

export default function useUA() {
  const bonTalk = useBonTalk()
  const { startRingTone, stopRingTone, toggleDTMF } = useAudio()
  const { setView, setCurrentCallingTarget } = useView()

  const [receivedInvitation, setReceivedInvitation] = useState<Invitation | null>(null)

  useEffect(() => {
    if (!bonTalk) return

    async function _login() {
      await bonTalk?.login()

      bonTalk?.addDelegate("onInvite", (invitation: Invitation) => {
        startRingTone()
        setView("RECEIVED_CALL")
        setReceivedInvitation(invitation)
        invitation.stateChange.addListener((state: SessionState) => {
          console.log("STATE", state)
          switch (state) {
            case SessionState.Initial:
              break
            case SessionState.Establishing:
              break
            case SessionState.Established:
              stopRingTone()
              setView("IN_CALL")
              setCurrentCallingTarget("incoming")
              BonTalk.setupRemoteMedia(invitation, bonTalk?.audioElement)
              setReceivedInvitation(null)
              break
            case SessionState.Terminating:
            case SessionState.Terminated:
              stopRingTone()
              removeLocalVideo()
              removeRemoteVideo()
              setView("KEY_PAD")
              BonTalk.cleanupMedia(bonTalk?.audioElement)
              break
            default:
              throw new Error("Unknown session state.")
          }
        })
      })
    }

    // TODO: React.strictMode warning
    _login()
  }, [])

  const audioCall = async (target: string, as: SessionName) => {
    if (!bonTalk) return
    if (!target) return

    try {
      return await bonTalk.audioCall(target, as)
    } catch (error) {
      console.error(`[${bonTalk.userAgentInstance?.instanceId}] failed to place call`)
      console.error(error)
      alert("Failed to place call.\n" + error)
    }
  }

  const answerCall = async () => {
    if (!bonTalk) return
    if (!receivedInvitation) return
    try {
      await bonTalk.answerCall(receivedInvitation, "incoming")
    } catch (error) {
      console.error(`[${bonTalk.userAgentInstance?.instanceId}] failed to answer call`)
      console.error(error)
      alert("Failed to answer call.\n" + error)
    }
  }

  const rejectCall = async () => {
    if (!bonTalk) return
    if (!receivedInvitation) return
    try {
      await bonTalk.rejectCall(receivedInvitation)
      console.log("拒接")
    } catch (error) {
      console.error(`[${bonTalk.userAgentInstance?.instanceId}] failed to reject call`)
      console.error(error)
      alert("Failed to reject call.\n" + error)
    }
  }

  const hangupCall = async (target: SessionName) => {
    if (!bonTalk) return
    try {
      await bonTalk.hangupCall(target)
    } catch (error) {
      console.error(`[${bonTalk.userAgentInstance?.instanceId}] failed to hangup call`)
      console.error(error)
      alert("Failed to hangup call.\n" + error)
    }
  }

  const setHold = async (hold: boolean, target: SessionName) => {
    if (!bonTalk) return
    try {
      await bonTalk.setHold(hold, target)
    } catch (error) {
      console.error(`[${bonTalk.userAgentInstance?.instanceId}] failed to hold call`)
      console.error(error)
      alert("Failed to hold call.\n" + error)
    }
  }

  const setMute = (mute: boolean, target: SessionName) => {
    if (!bonTalk) return
    bonTalk.toggleMicrophone(mute, target)
  }

  const setVideoTransport = (videoSwitch: boolean, target: SessionName) => {
    if (!bonTalk) return
    bonTalk.toggleVideoTransport(videoSwitch, target)
  }

  const sendDTMF = async (tone: string, to: SessionName) => {
    if (!bonTalk) return
    try {
      await bonTalk.sendDTMF(tone, to)
      toggleDTMF()
    } catch (error) {
      console.error(`[${bonTalk.userAgentInstance?.instanceId}] failed to send DTMF`)
      console.error(error)
      alert("Failed to send DTMF.\n" + error)
    }
  }

  const blindTransfer = async (from: SessionName, to: string) => {
    if (!bonTalk) return
    try {
      await bonTalk.blindTransfer(from, to)
    } catch (error) {
      console.error(`[${bonTalk.userAgentInstance?.instanceId}] failed to blind transfer`)
      console.error(error)
      alert("Failed to blind transfer.\n" + error)
    }
  }

  const preAttendedTransfer = async (from: SessionName, to: string) => {
    if (!bonTalk) return
    try {
      return await bonTalk.preAttendedTransfer(from, to)
    } catch (error) {
      console.error(`[${bonTalk.userAgentInstance?.instanceId}] failed to attended transfer - invite`)
      console.error(error)
      alert("Failed to attended transfer - invite.\n" + error)
    }
  }

  const attendedTransfer = async (from: SessionName, to: SessionName) => {
    if (!bonTalk) return
    try {
      await bonTalk.attendedTransfer(from, to)
    } catch (error) {
      console.error(`[${bonTalk.userAgentInstance?.instanceId}] failed to attended transfer - transfer`)
      console.error(error)
      alert("Failed to attended transfer - transfer.\n" + error)
    }
  }

  const setupLocalVideo = async () => {
    if (!bonTalk) return
    return await bonTalk.setupLocalVideo()
  }

  const removeLocalVideo = () => {
    if (!bonTalk) return
    return bonTalk.removeLocalVideo()
  }

  const setupRemoteVideo = (session: SessionName) => {
    if (!bonTalk) return
    return bonTalk.setupRemoteVideo(session)
  }

  const removeRemoteVideo = () => {
    if (!bonTalk) return
    return bonTalk.removeRemoteVideo()
  }


  return {
    receivedInvitation,
    audioCall,
    answerCall,
    rejectCall,
    hangupCall,
    setHold,
    sendDTMF,
    setMute,
    setVideoTransport,
    blindTransfer,
    preAttendedTransfer,
    attendedTransfer,
    setupLocalVideo,
    removeLocalVideo,
    setupRemoteVideo,
    removeRemoteVideo,
  }
}
