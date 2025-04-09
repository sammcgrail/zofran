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
  const [username] = useState(() => Math.floor(Math.random() * 10000).toString()); // Random numeric username
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]); // Store chat messages
  const [ws, setWs] = useState(null); // WebSocket instance
  const messagesEndRef = useRef(null); // Ref to scroll to the latest message

  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:5000/ws");

    websocket.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]); // Append new message
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || !ws) return;

    // Send message with username through WebSocket
    ws.send(JSON.stringify({ username, message }));
    setMessage(""); // Clear the input field
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container
        maxWidth="sm"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          textAlign: "center",
        }}
      >
        <Typography variant="h4" gutterBottom>
          Chatroom
        </Typography>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            width: "100%",
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
            mt: 4,
            width: "100%",
            height: "50vh",
            overflowY: "auto", // Enable scrolling for the chat log
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "8px",
          }}
        >
          <Typography variant="h6" gutterBottom>
            Chat Messages:
          </Typography>
          <List>
            {messages.map((msg, index) => {
              const { username, message } = JSON.parse(msg);
              return (
                <ListItem key={index} divider>
                  <ListItemText primary={`${username}: ${message}`} />
                </ListItem>
              );
            })}
            <div ref={messagesEndRef} /> {/* Scroll target */}
          </List>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
