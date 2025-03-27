import App from "@/components/App"
import ReactDOM from "react-dom/client"
import BonTalkProvider from "@/Provider/BonTalkProvider"
import "./normalize.css"
import "./plugin.css"
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
} from "sip.js"
import BonTalkError from "@/utils/BonTalkError"
import ThemeProvider from "@/Provider/ThemeProvider"
import ErrorBoundary from "@/components/ErrorBoundary"
import ViewProvider from "@/Provider/ViewProvider"
import AudioProvider from "@/Provider/AudioProvider"

type ResponsiveConfig = {
  breakpoint: number;
  position?: 'left' | 'right';
  zIndex?: number;
  topOffset?: number;
  hidden?: boolean;
}

type PanelConfig = {
  position?: 'left' | 'right';
  topOffset?: number;
  zIndex?: number;
  responsive?: ResponsiveConfig[];
}

export default class BonTalk {
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

  public sessionManager: SessionManager = new SessionManager()

  private themeColor?: string
  private panelConfig?: PanelConfig;
  private resizeObserver: ResizeObserver | null = null;

  public audioElementId: string = "_bon_sip_phone_audio"
  public localVideoElementId: string = "_bon_sip_phone_local_video"
  public remoteVideoElementId: string = "_bon_sip_phone_remote_video"

  static get rootId() {
    return "_bon_sip_phone_root"
  }

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
    wsServer,
    domains,
    username,
    password,
    displayName,
    themeColor,
    panelConfig = {},
    audioElementId,
    localVideoElementId,
    remoteVideoElementId
  }: {
    wsServer: string
    domains: string[]
    username: string
    password: string
    displayName: string
    themeColor?: string
    panelConfig?: PanelConfig
    audioElementId?: string
    localVideoElementId?: string
    remoteVideoElementId?: string
  }) {
    this.wsServer = wsServer
    this.audioElementId = audioElementId ?? this.audioElementId
    this.localVideoElementId = localVideoElementId ?? this.localVideoElementId
    this.remoteVideoElementId = remoteVideoElementId ?? this.remoteVideoElementId

    if (domains.length === 0) {
      throw new BonTalkError("[bonTalk] domains should not be empty")
    }
    this.domains = domains

    this.username = username
    this.password = password
    this.displayName = displayName

    this.themeColor = themeColor
    // Set default values for panel configuration
    this.panelConfig = {
      position: panelConfig.position || 'right',
      topOffset: panelConfig.topOffset || 0,
      zIndex: panelConfig.zIndex || 1000, // 設置默認 zIndex
      responsive: panelConfig.responsive || []
    };

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

  private setupResizeObserver() {
    if (this.resizeObserver) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });

    this.resizeObserver.observe(document.body);
  }

  private handleResize() {
    if (!this.rootElement || !this.panelConfig?.responsive) {
      return;
    }

    const width = window.innerWidth;

    // Sort responsive configs by breakpoint in descending order
    const sortedConfigs = [...this.panelConfig.responsive]
      .sort((a, b) => b.breakpoint - a.breakpoint);

    // Initialize newConfig with default values
    const newConfig = {
      position: this.panelConfig.position,
      topOffset: this.panelConfig.topOffset,
      zIndex: this.panelConfig.zIndex,
      hidden: false
    };

    // Find the first matching breakpoint and merge configurations
    for (const config of sortedConfigs) {
      if (width >= config.breakpoint) {
        Object.assign(newConfig, config);
        break;
      }
    }

    // Apply the new configuration
    this.applyPanelStyles(newConfig);
    
    // 重新调用togglePanel以确保正确的开关状态
    this.togglePanel();
  }

  private applyPanelStyles(config: {
    position?: 'left' | 'right';
    topOffset?: number;
    zIndex?: number;
    hidden?: boolean;
  }) {
    if (!this.rootElement) {
      return;
    }

    const positionStyles = {
      left: { left: '0', right: 'auto' },
      right: { right: '0', left: 'auto' }
    };

    const { left, right } = positionStyles[config.position || 'right'];
    this.rootElement.style.left = left;
    this.rootElement.style.right = right;

    // Top offset
    this.rootElement.style.top = `${config.topOffset || 0}px`;

    // Visibility
    this.rootElement.style.display = config.hidden ? 'none' : 'block';

    // 初始状态设置为关闭
    this.rootElement.style.transform = config.position === 'left'
      ? 'translateX(-100%)'
      : 'translateX(100%)';

    // 設置 zIndex
    this.rootElement.style.zIndex = `${config.zIndex || this.panelConfig?.zIndex}`;
  }
  private onCallInitialCallback: (() => void) | null = null;
  private onCallEstablishingCallback: (() => void) | null = null;
  private onCallEstablishedCallback: (() => void) | null = null;
  private onCallTerminatingCallback: (() => void) | null = null;
  private onCallTerminatedCallback: (() => void) | null = null;

  onCallInitial(callback: () => void) {
    this.onCallInitialCallback = callback;
  }

  onCallEstablishing(callback: () => void) {
    this.onCallEstablishingCallback = callback;
  }

  onCallEstablished(callback: () => void) {
    this.onCallEstablishedCallback = callback;
  }

  onCallTerminating(callback: () => void) {
    this.onCallTerminatingCallback = callback;
  }

  onCallTerminated(callback: () => void) {
    this.onCallTerminatedCallback = callback;
  }

  private triggerOnCallInitial() {
    if (this.onCallInitialCallback) {
      this.onCallInitialCallback();
    }
  }

  private triggerOnCallEstablishing() {
    if (this.onCallEstablishingCallback) {
      this.onCallEstablishingCallback();
    }
  }

  private triggerOnCallEstablished() {
    if (this.onCallEstablishedCallback) {
      this.onCallEstablishedCallback();
    }
  }

  private triggerOnCallTerminating() {
    if (this.onCallTerminatingCallback) {
      this.onCallTerminatingCallback();
    }
  }

  private triggerOnCallTerminated() {
    if (this.onCallTerminatedCallback) {
      this.onCallTerminatedCallback();
    }
  }

  get userAgentInstance() {
    return this.userAgent
  }

  get registererInstance() {
    return this.registerer
  }

  get rootId() {
    return BonTalk.rootId
  }

  get callId() {
    return this.sessionManager.callId
  } 

  get audioElement() {
    const element = document.getElementById(this.audioElementId)
    if (!element) {
      throw new BonTalkError(`[bonTalk] audioElement with id ${this.audioElementId} not found`)
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
    const invitationAcceptOptions: InvitationAcceptOptions = {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: true,
        },
      },
    }

    const audioElement = document.getElementById(this.audioElementId)

    if (!audioElement) {
      throw new BonTalkError(`[bonTalk] audioElement with id ${this.audioElementId} not found`)
    }

    const targetURI = BonTalk.makeURI(this.urlTemplate(target))
    const inviter = new Inviter(this.userAgent, targetURI)
    console.warn("inviter", inviter.stateChange)
    this.sessionManager.addSession(as, inviter)
    inviter.stateChange.addListener((state: SessionState) => {
      switch (state) {
        case SessionState.Initial:
          this.triggerOnCallInitial();
          // console.log("初始化")
          break
        case SessionState.Establishing:
          this.triggerOnCallEstablishing();
          // console.log("建立中")
          break
        case SessionState.Established:
          BonTalk.setupRemoteMedia(inviter, audioElement as HTMLMediaElement)
          const isVideoEnabled = this.sessionManager.isSessionVideoEnabled(as);
          this.toggleVideoTransport(isVideoEnabled, as)
          this.triggerOnCallEstablished();
          // console.log("已建立")
          break
        case SessionState.Terminating:
          this.triggerOnCallTerminating();
          // console.log("結束中")
          break
        case SessionState.Terminated:
          console.warn("已掛斷 Terminated")
          this.sessionManager.removeSession(as)
          BonTalk.cleanupMedia(audioElement as HTMLMediaElement)
          this.removeLocalVideo()
          this.removeRemoteVideo()
          this.triggerOnCallTerminated();
          // console.log("已結束")
          break
        default:
          throw new Error("Unknown session state.")
      }
    })
    await inviter.invite(invitationAcceptOptions)
    return inviter
  }

  async answerCall(invitation: Invitation, as: SessionName) {
    if (!invitation) {
      throw new BonTalkError("[bonTalk] invitation not initialized")
    }
    const invitationAcceptOptions: InvitationAcceptOptions = {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: true,
        },
      },
    }
    const audioElement = document.getElementById(this.audioElementId)
    if (!audioElement) {
      throw new BonTalkError(`[bonTalk] audioElement with id ${this.audioElementId} not found`)
    }
    await invitation.accept(invitationAcceptOptions)
    this.sessionManager.addSession(as, invitation)

    const customSession = this.sessionManager.getSession(as)
    const currentSession = customSession?.session
    if (!currentSession) {
      return
    }
    switch (currentSession.state) {
      case SessionState.Initial:
      case SessionState.Establishing:
      case SessionState.Established:
        const isVideoEnabled = this.sessionManager.isSessionVideoEnabled(as);
        this.toggleVideoTransport(isVideoEnabled, as)
        break
      case SessionState.Terminating:
      case SessionState.Terminated:
    }
  }

  async rejectCall(invitation: Invitation) {
    if (!invitation) {
      throw new BonTalkError("[bonTalk] invitation not initialized")
    }

    await invitation.reject()
  }

  async hangupCall(sessionName: SessionName) {
    const customSession = this.sessionManager.getSession(sessionName)
    const currentSession = customSession?.session
    if (!currentSession) {
      return
    }
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
    console.log(`[setHold] to switch hold to ${hold}, sessionName: ${sessionName}`)
    const customSession = this.sessionManager.getSession(sessionName)
    const currentSession = customSession?.session
    if (!currentSession) {
      return
    }

    if (currentSession.state === SessionState.Established) {
      const options: SessionInviteOptions = {
        requestDelegate: {
          onReject: () => { },
        },
        sessionDescriptionHandlerOptions: {
          // @ts-expect-error missing type
          hold,
        },
      }
      await currentSession.invite(options)

      if (hold) {
        this.sessionManager.holdSession(sessionName)
      } else {
        this.sessionManager.unHoldSession(sessionName)
      }
    }
  }

  async setupLocalVideo() {
    try {
     const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
     const localVideoElement = document.getElementById(this.localVideoElementId) as HTMLVideoElement;
     if (!localVideoElement) return console.error("Local video element not found.")
      localVideoElement.srcObject = stream;
    } catch (error) {
      console.error("Error accessing local media devices.", error);
    }
  }

  removeLocalVideo() {
    const localVideoElement = document.getElementById(this.localVideoElementId) as HTMLVideoElement;
    if (!localVideoElement || !localVideoElement.srcObject) return console.error("Local video element not found.");
      const stream = localVideoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop()
      });
      localVideoElement.srcObject = null;
  }

  setupRemoteVideo(sessionName: SessionName) {
    const customSession = this.sessionManager.getSession(sessionName);
    const currentSession = customSession?.session;
    if (!currentSession || !currentSession.sessionDescriptionHandler) return console.error("Session not found or sessionDescriptionHandler not found.");

    const remoteStream = new MediaStream();
    const peerConnection = (currentSession.sessionDescriptionHandler as unknown as { peerConnection: RTCPeerConnection }).peerConnection;
    peerConnection.getReceivers().forEach((receiver: { track: MediaStreamTrack; }) => {
      if (receiver.track) {
        remoteStream.addTrack(receiver.track);
      }
    });

    const remoteVideoElement = document.getElementById(this.remoteVideoElementId) as HTMLVideoElement;
    if (remoteVideoElement) {
      remoteVideoElement.srcObject = remoteStream;
    }
    console.log(navigator.mediaDevices)
  }

  removeRemoteVideo() {
    const remoteVideoElement = document.getElementById(this.remoteVideoElementId) as HTMLVideoElement;
    if (!remoteVideoElement) return console.error("Remote video element not found.")
    remoteVideoElement.srcObject = null;
  }

  /**
   * Puts Session on mute.
   * @param mute - Mute on if true, off if false.
   */
  toggleMicrophone(mute: boolean, sessionName: SessionName) {
    const customSession = this.sessionManager.getSession(sessionName)
    const currentSession = customSession?.session
    if (!currentSession) {
      return
    }
    // @ts-expect-error sip.js types are not up to date
    currentSession.sessionDescriptionHandler!.peerConnection.getLocalStreams().forEach(function (stream) {
      // @ts-expect-error sip.js types are not up to date
      stream.getAudioTracks().forEach(function (track) {
        track.enabled = !mute
      })
    })

    if (mute) {
      this.sessionManager.muteSession(sessionName)
    } else {
      this.sessionManager.unmuteSession(sessionName)
    }
    // MUTE HOLD NEED TO STATE
  }

  /**
   * Toggles the local video stream on or off.
   * @param enable - If true, enables the video; if false, disables the video.
   * @param sessionName - The name of the session to toggle video for.
   */
  toggleVideoTransport(enable: boolean, sessionName: SessionName) {
    const customSession = this.sessionManager.getSession(sessionName);
    const currentSession = customSession?.session;
    if (!currentSession) return console.error("Session not found.");
    // @ts-expect-error sip.js types are not up to date
    currentSession.sessionDescriptionHandler?.peerConnection?.getLocalStreams().forEach((stream) => {
      // @ts-expect-error sip.js types are not up to date
      stream.getVideoTracks().forEach((track) => {
        track.enabled = enable;
      });
    });

    if (enable) {
      this.sessionManager.enableVideoSession(sessionName);
    } else {
      this.sessionManager.disableVideoSession(sessionName);
    }
  }

  async sendDTMF(tone: string, sessionName: SessionName) {
    const currentSession = this.sessionManager.getSession(sessionName)
    if (!currentSession?.session) {
      throw new BonTalkError("[bonTalk] session not initialized")
    }
    const sessionInfoOptions = {
      requestOptions: {
        body: {
          contentDisposition: "render",
          contentType: "application/dtmf-relay",
          content: `Signal=${tone}\r\nDuration=100`,
        },
      },
    }
    await currentSession.session.info(sessionInfoOptions)
  }

  async blindTransfer(from: SessionName, target: string) {
    const newTarget = UserAgent.makeURI(this.urlTemplate(target))
    if (!newTarget) {
      throw new BonTalkError("[bonTalk] new target is not defined")
    }
    const customSession = this.sessionManager.getSession(from)
    const currentSession = customSession?.session
    if (!currentSession) {
      throw new BonTalkError("[bonTalk] session not initialized")
    }
    currentSession.refer(newTarget)

    this.sessionManager.removeSession(from)
  }

  async preAttendedTransfer(from: SessionName, target: string) {
    await this.setHold(true, from)
    return await this.audioCall(target, "attendedRefer")
  }

  async attendedTransfer(from: SessionName, target: SessionName) {
    const customSession = this.sessionManager.getSession(from)
    const firstSession = customSession?.session
    if (!firstSession) {
      throw new BonTalkError("[bonTalk] first session not initialized")
    }

    const customSession2 = this.sessionManager.getSession(target)
    const secondSession = customSession2?.session
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
  init() {
    if (this.reactRoot) {
      console.warn("[bonTalk] init() was called, to prevent unexpected behavior the process will return here.")
      return
    }

    const body = document.body

    const root = document.createElement("div")
    root.id = this.rootId
    root.dataset.isToggle = "false"
    this.rootElement = root

    // Apply initial styles
    this.rootElement.style.position = "fixed";
    this.rootElement.style.transition = "transform 0.3s linear";

    // 應用初始配置
    // Apply initial configuration

    // 獲取當前窗口寬度
    const windowWidth = window.innerWidth

    // 根據斷點從大到小排序配置數組
    const sortBreakpoint = this.panelConfig?.responsive?.sort((a, b) => b.breakpoint - a.breakpoint)
    // 找到第一個小於或等於當前窗口寬度的斷點配置
    const breakpoint = sortBreakpoint?.find((item) => windowWidth >= item.breakpoint)
    // 應用面板樣式
    this.applyPanelStyles({
      // 使用找到的斷點位置,如果沒有則使用默認位置
      position: breakpoint?.position || this.panelConfig?.position,
      // 使用找到的斷點頂部偏移,如果沒有則使用默認頂部偏移
      topOffset: breakpoint?.topOffset || this.panelConfig?.topOffset,
    });

    body.appendChild(root)

    // Setup resize observer for responsive behavior
    this.setupResizeObserver();

    this.reactRoot = ReactDOM.createRoot(root)
    this.reactRoot.render(
      <ErrorBoundary>
        <ThemeProvider mode="dark" customThemeColor={this.themeColor}>
          <BonTalkProvider value={this}>
            <AudioProvider>
              <ViewProvider>
                <App />
              </ViewProvider>
            </AudioProvider>
          </BonTalkProvider>
        </ThemeProvider>
      </ErrorBoundary>
    )
  }

  /**
   * open or close the panel
   */
  togglePanel() {
    if (!this.rootElement) {
      return;
    }
    
    const isOpening = this.rootElement.style.transform !== 'translateX(0%)';
    const position = this.rootElement.style.right === 'auto' ? 'left' : 'right';

    this.rootElement.style.transform = isOpening
      ? 'translateX(0%)'
      : `translateX(${position === 'left' ? '-100%' : '100%'})`;

    this.rootElement.dataset.isToggle = isOpening ? 'true' : 'false';

    const numberPad = document.getElementById("key-pad");
    if (numberPad && isOpening) {
      numberPad.focus();
    }
  }

  /**
   * destroy the panel
   * should call before destroy the element
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.reactRoot) {
      this.reactRoot.unmount();
    }
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

export type SessionName = "incoming" | "outgoing" | "attendedRefer"
type SessionMap = {
  incoming: Invitation
  outgoing: Inviter
  attendedRefer: Inviter
}

class CustomSession {
  _id = Math.random().toString(36).substr(2, 9)
  session: Inviter | Invitation | null = null
  isMuted: boolean = false
  isHold: boolean = false
  time: number = 0
  timerId: number | null = null
  isVideoEnabled: boolean = true;

  get name() {
    if (!this.session) {
      return "No Session"
    }

    if (this.session instanceof Inviter) {
      return this.session.request.to.uri.user
    }

    if (this.session instanceof Invitation) {
      return this.session.request.from.displayName
    }

    return "Unknown"
  }

  constructor({
    session,
    isMuted,
    isHold,
    time,
    timerId,
    isVideoEnabled = false
  }: {
    session: Inviter | Invitation
    isMuted: boolean
    isHold: boolean
    time: number
    timerId: number | null
    isVideoEnabled?: boolean
  }) {
    this.session = session
    this.isMuted = isMuted
    this.isHold = isHold
    this.time = time
    this.timerId = timerId
    this.isVideoEnabled = isVideoEnabled;
  }

  copy() {
    return new CustomSession({
      session: this.session!,
      isMuted: this.isMuted,
      isHold: this.isHold,
      time: this.time,
      timerId: this.timerId,
      isVideoEnabled: this.isVideoEnabled
    })
  }
}
class SessionManager {
  /**
   * {
   *  incoming: invitation
   *  outgoing: inviter
   *  attendedRefer: inviter
   * }
   */
  private sessions: Map<SessionName, CustomSession> = new Map()

  public callId: string = ""

  listeners: ((...argus: unknown[]) => unknown)[] = []

  constructor() { }

  getSessions() {
    return this.sessions
  }

  addSession<T extends SessionName>(type: T, session: SessionMap[T]) {
    const newSession = new CustomSession({ session, isMuted: false, isHold: false, time: 0, timerId: null })
    this.sessions.set(type, newSession)
    this.emitChange()

    this.callId = session.request.callId

    newSession.timerId = window.setInterval(() => {
      try {
        const prevSession = this.sessions.get(type)!
        prevSession.time += 1
        const copiedSession = prevSession.copy()
        this.sessions.set(type, copiedSession)
        this.emitChange()
      } catch {
        console.log("clearInterval")
        window.clearInterval(newSession.timerId!)
      }
    }, 1000)
  }

  getSession<T extends SessionName | "">(type: T) {
    if (!type) {
      return null
    }

    return this.sessions.get(type)
  }

  removeSession<T extends SessionName>(type: T) {
    const session = this.sessions.get(type)
    if (session) {
      window.clearInterval(session.timerId!)
    }
    this.sessions.delete(type)
  }

  muteSession<T extends SessionName>(type: T) {
    const session = this.sessions.get(type)
    if (session) {
      session.isMuted = true
    }
  }

  unmuteSession<T extends SessionName>(type: T) {
    const session = this.sessions.get(type)
    if (session) {
      session.isMuted = false
    }
  }

  isSessionMuted<T extends SessionName>(type: T) {
    const session = this.sessions.get(type)
    return session ? session.isMuted : false
  }

  holdSession<T extends SessionName>(type: T) {
    const session = this.sessions.get(type)
    if (session) {
      session.isHold = true
      const newSession = session.copy()
      this.sessions.set(type, newSession)
      this.emitChange()
    }
  }

  unHoldSession<T extends SessionName>(type: T) {
    const session = this.sessions.get(type)
    if (session) {
      session.isHold = false
      const newSession = session.copy()
      this.sessions.set(type, newSession)
      this.emitChange()
    }
  }

  isSessionHold<T extends SessionName>(type: T) {
    const session = this.sessions.get(type)
    return session ? session.isHold : false
  }

  subscribe(listener: (...argus: unknown[]) => unknown) {
    this.listeners = [...this.listeners, listener]
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  emitChange() {
    this.listeners.forEach((listener) => {
      listener()
    })
  }

  enableVideoSession<T extends SessionName>(type: T) {
    const session = this.sessions.get(type);
    if (session) {
      session.isVideoEnabled = true;
      const newSession = session.copy();
      this.sessions.set(type, newSession);
      this.emitChange();
    }
  }

  disableVideoSession<T extends SessionName>(type: T) {
    const session = this.sessions.get(type);
    if (session) {
      session.isVideoEnabled = false;
      const newSession = session.copy();
      this.sessions.set(type, newSession);
      this.emitChange();
    }
  }

  isSessionVideoEnabled<T extends SessionName>(type: T) {
    const session = this.sessions.get(type);
    return session ? session.isVideoEnabled : false;
  }
}
