import { useEffect, useState } from "react"
import styled from "@emotion/styled"
import Phone from "../Icons/phone"
import BonTalk from "@/entry/plugin"

// const bonTalk = new BonTalk({
//   wsServer: "wss://demo.sip.telesale.org:7443/ws",
//   domains: ["demo.sip.telesale.org"],
//   username: "3003",
//   password: "42633506",
//   displayName: "3003 Charlie",
// })

const data = [
  { id: 1, name: "John Doe", age: 25, email: "john.doe@example.com" },
  { id: 2, name: "Jane Smith", age: 30, email: "jane.smith@example.com" },
  { id: 3, name: "Bob Johnson", age: 35, email: "bob.johnson@example.com" },
  { id: 4, name: "Alice Brown", age: 40, email: "" },
  { id: 5, name: "Eve White", age: 45, email: "eve.white@example.com" },
  { id: 6, name: "Tom Black", age: 50, email: "" },
]

export default function Playground() {
  const [open, setOpen] = useState(false)
  const [bonTalk, setBonTalk] = useState<BonTalk | null>(null)
  const [callId, setCallId] = useState("");
  const [sipState, setSipState] = useState("");

  const handleOpenPanel = () => {
    if (bonTalk) {
      bonTalk.togglePanel()
      return
    }

    const wsServer = localStorage.getItem("WebsocketServer") ?? ""
    const domain = localStorage.getItem("Domain") ?? ""
    const username = localStorage.getItem("Username") ?? ""
    const password = localStorage.getItem("Password") ?? ""
    const displayName = localStorage.getItem("DisplayName") ?? ""

    if (!wsServer || !domain || !username || !password || !displayName) {
      window.alert("Please fill in all fields in the phone settings")
      return
    }

    const bonTalkInstance = new BonTalk({
      wsServer: wsServer,
      domains: [domain],
      username: username,
      password: password,
      displayName: displayName,
      panelConfig: {
        position: 'right',
        topOffset: 70,
        zIndex: 1000, // 使用用戶設置的 zIndex
        responsive: [
          {
            breakpoint: 320,  // >= 320px
            hidden: true     // 在小螢幕上隱藏
          },
          {
            breakpoint: 768,  // >= 768px
            position: 'left',
            topOffset: 70,
            zIndex: 10000, // 可以為不同斷點設置不同的 zIndex
          },
          {
            breakpoint: 480,  // >= 480px
            position: 'left',
            topOffset: 100,
          },
          {
            breakpoint: 1024, // >= 1024px
            position: 'right',
            topOffset: 50,
          }
        ]
      }
    })
    setBonTalk(bonTalkInstance)
   
    // bonTalkInstance.onCallInitial(() => {
    //   console.log("準備中");
    // });
    
    // bonTalkInstance.onCallEstablishing(() => {
    //   console.log("建立中");
    // });
    
    // bonTalkInstance.onCallEstablished(() => {
    //   console.log("已建立");
    //   console.log(bonTalkInstance?.callId)
    // });
    
    // bonTalkInstance.onCallTerminating(() => {
    //   console.log("結束中");
    // });
    
    // bonTalkInstance.onCallTerminated(() => {
    //   console.log("已結束");
    // });
    bonTalkInstance.init()
  }



  const handleInputChange = (name: string, value: string) => {
    localStorage.setItem(name, value)
  }

  useEffect(()=>{
    if(bonTalk) {
      bonTalk.onCallInitial(() => {
        console.log("準備中");
        setSipState("Initial");
      });
      
      bonTalk.onCallEstablishing(() => {
        console.log("建立中");
        setSipState("Establishing");
      });
      
      bonTalk.onCallEstablished(() => {
        console.log("已建立");
        setSipState("Established");
        console.log(bonTalk.callId);
        setCallId(bonTalk.callId);
      });
      
      bonTalk.onCallTerminating(() => {
        console.log("結束中");
        setSipState("Terminating");
      });
      
      bonTalk.onCallTerminated(() => {
        console.log("已結束");
        setSipState("Terminated");
      });
    }
  },[bonTalk])

  return (
    <Container>
      <Nav>
        <Title>SuperDesk CRM</Title>
        <div style={{ flex: 1 }} />
        <Button>Home</Button>
        <Button>Order</Button>
        <Button>Login</Button>
        <Divider />
        <IconButton onClick={handleOpenPanel}>
          <Phone />
        </IconButton>
        <Button onClick={() => setOpen((prev) => !prev)}>PHONE SETTINGS</Button>
      </Nav>
      <Body>
        {open && (
          <PhoneSettings>
            <CallData>
              <div>
                <h4>CallId : {callId}</h4>
                <h4>sipState : {sipState}</h4>
              </div>  
            </CallData>
            <Settings>
              <Button onClick={() => setOpen(false)}> {"< BACK"}</Button>
              <input
                placeholder="Username"
                defaultValue={localStorage.getItem("Username") ?? ""}
                onChange={(e) => handleInputChange("Username", e.target.value)}
              />
              <input
                placeholder="Password"
                defaultValue={localStorage.getItem("Password") ?? ""}
                onChange={(e) => handleInputChange("Password", e.target.value)}
              />
              <input
                placeholder="DisplayName"
                defaultValue={localStorage.getItem("DisplayName") ?? ""}
                onChange={(e) => handleInputChange("DisplayName", e.target.value)}
              />
              <input
                placeholder="WebsocketServer"
                defaultValue={localStorage.getItem("WebsocketServer") ?? ""}
                onChange={(e) => handleInputChange("WebsocketServer", e.target.value)}
              />
              <input
                placeholder="Domain"
                defaultValue={localStorage.getItem("Domain") ?? ""}
                onChange={(e) => handleInputChange("Domain", e.target.value)}
              />
            </Settings>
          </PhoneSettings>

        )}
        {!open && (
          <>
            <h1>Sales Profit</h1>
            <h2>Today's profit is $5000</h2>
            <h3>Yearly: $100,000 | Monthly: $10,000 | Weekly: $2,500 | Daily: $500</h3>
            <p>
              Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy
              text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has
              survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was
              popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop
              publishing software like Aldus PageMaker including versions of Lorem Ipsum.
            </p>
            <br />
            <h2>Customer List</h2>
            <input placeholder="Search" />
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.age}</td>
                    <td>{item.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Body>
    </Container>
  )
}

const Container = styled.div({
  width: "100vw",
  height: "100vh",

  flexDirection: "column",
  backgroundColor: "#f0f0f0",
})

const Nav = styled.nav({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  padding: "0px 32px",
  height: "70px",
  maxWidth: "100%",
  backgroundColor: "#333",
  color: "white",
  zIndex: 100,

  "@media (max-width: 480px)": {
    height: "70px",
  },
  
  "@media (max-width: 768px)": {
    height: "100px",
  },
  
  "@media (min-width: 1024px)": {
    height: "50px",
  },
})

const Title = styled.div({
  fontSize: "1.5rem",
  fontWeight: "bold",
})

const Divider = styled.div({
  height: "50%",
  width: "1px",
  backgroundColor: "white",
})

const Button = styled.button({
  border: "none",
  backgroundColor: "transparent",
  padding: "8px",
  borderRadius: "4px",
  color: "currentColor",
  cursor: "pointer",
  transition: "background-color 0.2s",
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
})

const IconButton = styled.button({
  border: "none",
  backgroundColor: "transparent",
  color: "white",
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "0px",
  cursor: "pointer",
  transition: "background-color 0.2s",
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
})

const Body = styled.div({
  flex: 1,
  padding: "16px",

  "& input": {
    width: "200px",
    padding: "8px",
    marginBottom: "16px",
    borderRadius: "4px",
    border: "1px solid #ddd",
  },

  "& table": {
    width: "100%",
    borderCollapse: "collapse",
    "& th, td": {
      border: "1px solid #dadada",
      padding: "8px",
      textAlign: "left",
    },
    "& th": {
      backgroundColor: "#efe0e0",
    },
    "& tr:nth-of-type(even)": {
      backgroundColor: "#fafafa",
    },
  },
})

const PhoneSettings = styled.div({
  display: "flex"
})

const CallData = styled.div({
  div: {
  borderRadius: "16px",
  backgroundColor: "#DCDCDC",
  minWidth: "600px",
  padding: "1px 16px"
  }

})

const Settings = styled.div({
  marginLeft: "auto",
  width: "300px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "32px",
  backgroundColor: "white",
  borderRadius: "8px",
  boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.1)",

  "& > input": {
    width: "100%",
  },
})
