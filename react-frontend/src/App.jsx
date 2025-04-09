import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  CssBaseline,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  const [username] = useState(() => `John${Math.floor(Math.random() * 1000)}`); // Random "John" variation username
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]); // Store chat messages
  const [ws, setWs] = useState(null); // WebSocket instance
  const canvasRef = useRef(null); // Canvas reference
  const isDrawing = useRef(false); // Track drawing state
  const messagesEndRef = useRef(null); // Ref to scroll to the latest message

  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:5000/ws");

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "draw") {
        drawOnCanvas(data.x, data.y, data.prevX, data.prevY, data.color);
      } else if (data.type === "chat") {
        setMessages((prev) => [...prev, data]);
      }
    };

    websocket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    setWs(websocket);

    return () => {
      websocket.close(); // Cleanup WebSocket connection on component unmount
    };
  }, []);

  useEffect(() => {
    // Scroll to the latest message
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const drawOnCanvas = (x, y, prevX, prevY, color = "black") => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.closePath();
  };

  const handleMouseDown = () => {
    isDrawing.current = true;
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current || !ws) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const prevX = e.movementX ? x - e.movementX : x;
    const prevY = e.movementY ? y - e.movementY : y;

    // Draw locally
    drawOnCanvas(x, y, prevX, prevY);

    // Send drawing data to the server
    ws.send(
      JSON.stringify({
        type: "draw",
        x,
        y,
        prevX,
        prevY,
        color: "black",
        username,
      })
    );
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || !ws) return;

    // Send chat message to the server
    ws.send(
      JSON.stringify({
        type: "chat",
        message,
        username,
      })
    );
    setMessage(""); // Clear the input field
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container
        maxWidth="lg"
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          height: "100vh",
          padding: 2,
        }}
      >
        {/* Chat Section */}
        <Box
          sx={{
            width: "30%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: 2,
            overflow: "hidden", // Prevent overflow
          }}
        >
          <Typography variant="h5" gutterBottom>
            Chatroom
          </Typography>
          <Box
            component="form"
            onSubmit={handleChatSubmit}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginBottom: 2,
            }}
          >
            <TextField
              label="Enter your message"
              variant="outlined"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              fullWidth
            />
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Send
            </Button>
          </Box>
          <Box
            sx={{
              flex: 1, // Take up remaining space
              overflowY: "auto", // Enable vertical scrolling
            }}
          >
            <List>
              {messages.map((msg, index) => (
                <ListItem
                  key={index}
                  divider
                  sx={{
                    backgroundColor: msg.username === username ? "#333" : "#444", // Darker grey for all messages
                    color: msg.username === username ? "#fff" : "#ffeb3b", // White for self, yellow for others
                    borderRadius: "8px",
                    marginBottom: "8px",
                    padding: "8px",
                  }}
                >
                  <ListItemText primary={`${msg.username}: ${msg.message}`} />
                </ListItem>
              ))}
              <div ref={messagesEndRef} /> {/* Scroll target */}
            </List>
          </Box>
        </Box>

        {/* Drawing Canvas Section */}
        <Box
          sx={{
            width: "65%",
            height: "100%",
            border: "1px solid #ccc",
            borderRadius: "8px",
            position: "relative",
          }}
        >
          <Typography variant="h5" gutterBottom sx={{ textAlign: "center" }}>
            Collaborative Drawing Canvas
          </Typography>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{ width: "100%", height: "90%" }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
          />
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
