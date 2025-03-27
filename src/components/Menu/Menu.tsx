import styled from "@emotion/styled"
import Hold from "../Icons/hold"
import KeyPad from "../Icons/keypad"
import Mute from "../Icons/mute"
import PreForward from "../Icons/pre-forward"
import Switch from "../Icons/switch"
import VideoOutlined from "../Icons/video-outlined"

type Props = {
  onMuteClick?: () => void
  onHoldClick?: () => void
  onKeyPadClick?: () => void
  onVideoClick?: () => void
  onSwitchClick?: () => void
  onPreForwardClick?: () => void

  isMuted?: boolean
  isHold?: boolean
  disabledTransfer?: boolean
}
export default function Menu(props: Props) {
  const {
    onMuteClick,
    onHoldClick,
    onKeyPadClick,
    onVideoClick,
    onSwitchClick,
    onPreForwardClick,
    isMuted,
    isHold,
    disabledTransfer
  } = props
  
  return (
    <MenuContainer>
      <MenuButton onClick={onMuteClick} active={isMuted}>
        <Mute />
        <MenuText>{isMuted ? "取消靜音" : "靜音"}</MenuText>
      </MenuButton>
      <MenuButton onClick={onHoldClick} active={isHold}>
        <Hold />
        <MenuText>{isHold ? "取消保留" : "保留"}</MenuText>
      </MenuButton>
      <MenuButton onClick={onKeyPadClick}>
        <KeyPad />
        <MenuText>按鍵</MenuText>
      </MenuButton>
      <MenuButton onClick={onVideoClick}>
        <VideoOutlined />
        <MenuText>視訊</MenuText>
      </MenuButton>
      <MenuButton onClick={onSwitchClick} disabled={disabledTransfer}>
        <Switch />
        <MenuText>轉接</MenuText>
      </MenuButton>
      <MenuButton onClick={onPreForwardClick} disabled={disabledTransfer}>
        <PreForward />
        <MenuText>通話轉</MenuText>
      </MenuButton>
    </MenuContainer>
  )
}

const MenuContainer = styled("div")({
  display: "grid",
  gridTemplateColumns: "repeat(3, 72px)",
  gridAutoRows: "96px",
  columnGap: "24px",
  rowGap: "32px",
})

const MenuButton = styled("button")<{ active?: boolean }>((props) => ({
  background: "transparent",
  border: "none",
  cursor: "pointer",

  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",

  color: props.active ? props.theme.colors.action.active : props.theme.colors.text.white,

  ...(props.disabled && {
    color: props.theme.colors.action.disabled,
    cursor: "not-allowed",
  }),

  "& > svg": {
    width: "48px",
    height: "48px",
  },
  // BonTalk/Action/Light Blue
  "& > div": {
    fontSize: "24px",
    lineHeight: "normal",
    height: "32px",
  },
}))

const MenuText = styled("div")({
  whiteSpace: "nowrap",
})
