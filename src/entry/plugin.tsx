import App from "@/components/App"
import ReactDOM from "react-dom/client"
import BonTalkProvider from "@/Provider/BonTalkProvider"
import "./normalize.css"
import "./index.css"
import {
  Invitation,
  InvitationAcceptOptions,
  Inviter,
  Registerer,
  Session,
  SessionState,
  UserAgent,
  UserAgentDelegate,
  SessionInviteOptions,
  InviterOptions,
  SessionInfoOptions,
} from "sip.js"
import BonTalkError from "@/utils/BonTalkError"
import ThemeProvider from "@/Provider/ThemeProvider"
import ErrorBoundary from "@/components/ErrorBoundary"

export default class BonTalk {
  private rootId = "_bon_sip_phone_root"
  private _audioElementId = "_bon_sip_phone_audio"

  private buttonElementId: string
  // private buttonElement: HTMLElement | null = null
  private rootElement: HTMLElement | null = null
  private reactRoot: ReactDOM.Root | null = null

  private wsServer: string
  private domains: string[]
  private currentDomainIndex = 0
  private username: string
  private password: string
  private displayName: string

  private userAgent: UserAgent | null = null
  private noAnswerTimeout: number = 12

  private registerer: Registerer | null = null
  private registerExpires: number = 300

  private sessionManager: SessionManager = new SessionManager()

  static makeURI(target: string) {
    const uri = UserAgent.makeURI(target)
    if (!uri) {
      throw new BonTalkError("[bonTalk] failed to create uri")
    }
    return uri
  }

  static setupRemoteMedia(session: Session, mediaElement: HTMLMediaElement) {
    if (!session) {
      throw new BonTalkError("[bonTalk] session not initialized")
    }
    const remoteStream = new MediaStream()
    // @ts-expect-error sip.js types are not up to date
    session.sessionDescriptionHandler!.peerConnection.getReceivers().forEach((receiver) => {
      if (receiver.track) {
        remoteStream.addTrack(receiver.track)
      }
    })
    mediaElement.load()
    mediaElement.srcObject = remoteStream
    mediaElement.play()
  }

  static cleanupMedia(mediaElement: HTMLMediaElement) {
    mediaElement.srcObject = null
    mediaElement.pause()
  }

  constructor({
    buttonElementId,
    wsServer,
    domains,
    username,
    password,
    displayName,
  }: {
    buttonElementId: string
    wsServer: string
    domains: string[]
    username: string
    password: string
    displayName: string
  }) {
    this.buttonElementId = buttonElementId

    this.wsServer = wsServer

    if (domains.length === 0) {
      throw new BonTalkError("[bonTalk] domains should not be empty")
    }
    this.domains = domains

    this.username = username
    this.password = password
    this.displayName = displayName

    const uri = UserAgent.makeURI(this.urlTemplate(username))
    if (!uri) {
      throw new BonTalkError("[bonTalk] failed to create uri")
    }

    this.userAgent = new UserAgent({
      uri,
      displayName: this.displayName,
      authorizationPassword: this.password,
      authorizationUsername: this.username,
      noAnswerTimeout: this.noAnswerTimeout,
      transportOptions: {
        server: this.wsServer,
        traceSip: false,
      },
      contactParams: { transport: "wss" },
    })

    this.registerer = new Registerer(this.userAgent, {
      expires: this.registerExpires,
    })
  }

  get userAgentInstance() {
    return this.userAgent
  }

  get registererInstance() {
    return this.registerer
  }

  get audioElementId() {
    return this._audioElementId
  }

  get audioElement() {
    const element = document.getElementById(this._audioElementId)
    if (!element) {
      throw new BonTalkError(`[bonTalk] audioElement with id ${this._audioElementId} not found`)
    }
    return element as HTMLMediaElement
  }

  async login() {
    if (!this.userAgent) {
      throw new BonTalkError("[bonTalk] userAgent not initialized")
    }
    if (!this.userAgent.isConnected()) {
      try {
        await this.userAgent.start()
      } catch (err) {
        throw new BonTalkError(`[bonTalk] failed to connect userAgent: ${err}`)
      }
    } else {
      console.warn("[bonTalk] the userAgent.start() been called, userAgent already connected")
    }

    if (!this.registerer) {
      throw new BonTalkError("[bonTalk] registerer not initialized")
    }
    if (this.registerer?.state !== "Registered") {
      try {
        await this.registerer.register()
      } catch (err) {
        throw new BonTalkError(`[bonTalk] failed to register userAgent: ${err}`)
      }
    } else {
      console.warn("[bonTalk] the registerer.register() been called, registerer already registered")
    }
  }

  async logout() {
    if (!this.userAgent) {
      throw new BonTalkError("[bonTalk] userAgent not initialized")
    }
    if (!this.registerer) {
      throw new BonTalkError("[bonTalk] registerer not initialized")
    }
    await this.registerer.unregister()
  }

  async audioCall(target: string, as: SessionName) {
    if (!this.userAgent) {
      throw new BonTalkError("[bonTalk] userAgent not initialized")
    }

    const audioElement = document.getElementById(this._audioElementId)
    if (!audioElement) {
      throw new BonTalkError(`[bonTalk] audioElement with id ${this._audioElementId} not found`)
    }

    // send ticket ids
    const inviterOptions: InviterOptions = {
      extraHeaders: ["X-Ticket-Id:taiwan bonvies ticket system"]
    }

    const targetURI = BonTalk.makeURI(this.urlTemplate(target))
    const inviter = new Inviter(this.userAgent, targetURI, inviterOptions)
    inviter.stateChange.addListener((state: SessionState) => {
      switch (state) {
        case SessionState.Initial:
          break
        case SessionState.Establishing:
          break
        case SessionState.Established:
          this.sessionManager.addSession(as, inviter)
          BonTalk.setupRemoteMedia(inviter, audioElement as HTMLMediaElement)
          break
        case SessionState.Terminating:
        case SessionState.Terminated:
          this.sessionManager.removeSession(as)
          BonTalk.cleanupMedia(audioElement as HTMLMediaElement)
          break
        default:
          throw new Error("Unknown session state.")
      }
    })
    await inviter.invite()
  }

  async answerCall(invitation: Invitation, as: SessionName) {
    if (!invitation) {
      throw new BonTalkError("[bonTalk] invitation not initialized")
    }
    const invitationAcceptOptions: InvitationAcceptOptions = {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: false,
        },
      },
    }
    const audioElement = document.getElementById(this._audioElementId)
    if (!audioElement) {
      throw new BonTalkError(`[bonTalk] audioElement with id ${this._audioElementId} not found`)
    }
    await invitation.accept(invitationAcceptOptions)
    this.sessionManager.addSession(as, invitation)
  }

  async rejectCall(sessionName: SessionName) {
    const invitation = this.sessionManager.getSession(sessionName)

    if (!(invitation instanceof Invitation)) {
      throw new BonTalkError("[bonTalk] invitation is not an instance of Invitation")
    }
    if (!invitation) {
      throw new BonTalkError("[bonTalk] invitation not initialized")
    }

    await invitation.reject()
  }

  async hangupCall(sessionName: SessionName) {
    const currentSession = this.sessionManager.getSession(sessionName)
    switch (currentSession.state) {
      case SessionState.Initial:
      case SessionState.Establishing:
        if (currentSession instanceof Inviter) {
          await currentSession.cancel()
        } else if (currentSession instanceof Invitation) {
          await currentSession.reject()
        } else {
          throw new BonTalkError("[bonTalk] unknown session type")
        }
        break
      case SessionState.Established:
        await currentSession.bye()
        await currentSession.dispose()
        break
      case SessionState.Terminating:
      case SessionState.Terminated:
        this.sessionManager.removeSession(sessionName)
        break
    }
  }

  async setHold(hold: boolean, sessionName: SessionName) {
    const currentSession = this.sessionManager.getSession(sessionName)

    if (currentSession.state === SessionState.Established) {
      const options: SessionInviteOptions = {
        requestDelegate: {
          onAccept: () => {
            // @ts-expect-error sip.js types are not up to date
            const pc = currentSession.sessionDescriptionHandler!.peerConnection
            // @ts-expect-error sip.js types are not up to date
            // Stop all the inbound streams
            pc.getReceivers().forEach((RTCRtpReceiver) => {
              if (RTCRtpReceiver.track) RTCRtpReceiver.track.enabled = !hold
            })
            // @ts-expect-error sip.js types are not up to date
            // Stop all the outbound streams (especially useful for Conference Calls!!)
            pc.getSenders().forEach(function (RTCRtpSender) {
              RTCRtpSender.track.enabled = !hold
            })
          },
          onReject: () => { },
        },
      }
      await currentSession.invite(options)
    }
  }

  /**
   * Puts Session on mute.
   * @param mute - Mute on if true, off if false.
   */
  toggleMicrophone(mute: boolean, sessionName: SessionName) {
    const currentSession = this.sessionManager.getSession(sessionName)
    // @ts-expect-error sip.js types are not up to date
    currentSession.sessionDescriptionHandler!.peerConnection.getLocalStreams().forEach(function (stream) {
      // @ts-expect-error sip.js types are not up to date
      stream.getAudioTracks().forEach(function (track) {
        track.enabled = !mute
      })
    })
  }

  async sendDTMF(tone: string, sessionName: SessionName) {
    const currentSession = this.sessionManager.getSession(sessionName)
    if (!currentSession) {
      throw new BonTalkError("[bonTalk] session not initialized")
    }
    const sessionInfoOptions: SessionInfoOptions = {
      requestOptions: {
        body: {
          contentDisposition: "render",
          contentType: "application/dtmf-relay",
          content: `Signal=${tone}\r\nDuration=100`,
        },
      },
    }
    await currentSession.info(sessionInfoOptions)
  }

  async blindTransfer(from: SessionName, target: string) {
    const newTarget = UserAgent.makeURI(this.urlTemplate(target))
    if (!newTarget) {
      throw new BonTalkError("[bonTalk] new target is not defined")
    }
    const currentSession = this.sessionManager.getSession(from)

    if (!currentSession) {
      throw new BonTalkError("[bonTalk] session not initialized")
    }
    currentSession.refer(newTarget)

    this.sessionManager.removeSession(from)
  }

  async preAttendedTransfer(from: SessionName, target: string) {
    this.setHold(true, from)
    this.audioCall(target, "attendedRefer")
  }

  async attendedTransfer(from: SessionName, target: SessionName) {
    const firstSession = this.sessionManager.getSession(from)
    if (!firstSession) {
      throw new BonTalkError("[bonTalk] first session not initialized")
    }

    const secondSession = this.sessionManager.getSession(target)
    if (!secondSession) {
      throw new BonTalkError("[bonTalk] second session not initialized")
    }

    await firstSession.refer(secondSession)

    this.sessionManager.removeSession(from)
    this.sessionManager.removeSession(target)
  }

  /**
   * render the panel, should only call once on every instance
   */
  render() {
    if (this.reactRoot) {
      throw new BonTalkError("[bonTalk] already rendered")
    }

    const body = document.body
    const buttonElement = document.getElementById(this.buttonElementId)

    if (!buttonElement) {
      throw new BonTalkError(`[bonTalk] buttonElement with id ${this.buttonElementId} not found`)
    }

    const root = document.createElement("div")
    root.id = this.rootId
    this.rootElement = root
    this.rootElement.style.position = "fixed"
    this.rootElement.style.top = "0"
    this.rootElement.style.right = "0"
    body.appendChild(root)

    // attach open event to button
    // this.buttonElement = buttonElement
    buttonElement.addEventListener("click", this.togglePanel.bind(this))

    this.reactRoot = ReactDOM.createRoot(root)
    this.reactRoot.render(
      <ErrorBoundary>
        <ThemeProvider mode="dark">
          <BonTalkProvider value={this}>
            <App />
          </BonTalkProvider>
        </ThemeProvider>
      </ErrorBoundary>
    )
  }

  /**
   * open or close the panel
   */
  togglePanel() {
    console.log("togglePanel")
    console.log(this.rootElement)
    if (!this.rootElement) {
      return
    }
    this.rootElement.style.transform = this.rootElement.style.transform === "translateX(100%)" ? "translateX(0)" : "translateX(100%)"
  }

  /**
   * destroy the panel
   * should call before destroy the element
   */
  destroy() {
    if (!this.reactRoot) {
      return
    }

    this.reactRoot.unmount()
  }

  /**
   *
   * @param target
   * @returns
   */
  urlTemplate(target: string) {
    return `sip:${target}@${this.domains[this.currentDomainIndex]}`
  }

  addDelegate<T extends keyof UserAgentDelegate>(onEvent: T, callback: UserAgentDelegate[T]) {
    if (!this.userAgent) {
      throw new BonTalkError("[bonTalk] userAgent not initialized")
    }
    if (!this.userAgent.delegate) {
      this.userAgent.delegate = {}
    }
    this.userAgent.delegate[onEvent] = callback
  }
}

type SessionName = "incoming" | "outgoing" | "attendedRefer"
type SessionMap = {
  incoming: Invitation
  outgoing: Inviter
  attendedRefer: Inviter
}
class SessionManager {
  /**
   * {
   *  incoming: invitation
   *  outgoing: inviter
   *  attendedRefer: inviter
   *  musicOnHold: 未知
   * }
   */
  private sessions: Map<SessionName, Inviter | Invitation | unknown> = new Map()

  constructor() { }

  getSessions() {
    return this.sessions
  }

  addSession<T extends SessionName>(type: T, session: SessionMap[T]) {
    this.sessions.set(type, session)
  }

  getSession<T extends SessionName>(type: T) {
    return this.sessions.get(type) as SessionMap[T]
  }

  removeSession<T extends SessionName>(type: T) {
    this.sessions.delete(type)
  }
}
