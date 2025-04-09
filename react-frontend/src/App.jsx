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
  const gameCanvasRef = useRef(null); // Game canvas reference
  const isDrawing = useRef(false); // Track drawing state
  const messagesEndRef = useRef(null); // Ref to scroll to the latest message
  const [spaceships, setSpaceships] = useState({}); // Store spaceships' positions
  const [counter, setCounter] = useState(0); // Multiplayer counter state
  const starfieldAnimationRef = useRef(null); // Ref to track starfield animation frame

  useEffect(() => {
    let websocket;
    let reconnectTimeout;

    const connectWebSocket = () => {
      websocket = new WebSocket("ws://localhost:5000/ws");

      websocket.onopen = () => {
        console.log("WebSocket connection established");
        setWs(websocket);

        // Request the current spaceship state once the connection is open
        websocket.send(JSON.stringify({ type: "request_spaceships" }));
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "draw") {
          drawOnCanvas(data.x, data.y, data.prevX, data.prevY, data.color);
        } else if (data.type === "drawing_history") {
          batchDrawOnCanvas(data.history);
        } else if (data.type === "chat") {
          setMessages((prev) => {
            // Avoid adding duplicate messages
            if (prev.length && prev[prev.length - 1].message === data.message && prev[prev.length - 1].username === data.username) {
              return prev;
            }
            return [...prev, data];
          });
        } else if (data.type === "spaceship_update") {
          setSpaceships(data.spaceships);
        } else if (data.type === "counter_update") {
          setCounter(data.value);
        }
      };

      websocket.onclose = () => {
        console.log("WebSocket connection closed. Attempting to reconnect...");
        reconnectTimeout = setTimeout(connectWebSocket, 3000); // Retry connection after 3 seconds
      };

      websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        websocket.close();
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (websocket) websocket.close();
    };
  }, []);

  useEffect(() => {
    // Scroll to the latest message
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const gameCanvas = gameCanvasRef.current;
    const gameCtx = gameCanvas.getContext("2d");

    const renderSpaceships = () => {
      gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // Clear canvas

      // Draw spaceships
      Object.values(spaceships).forEach((spaceship) => {
        gameCtx.fillStyle = spaceship.username === username ? "blue" : "red"; // Blue for self, red for others
        gameCtx.fillRect(spaceship.x, spaceship.y, 20, 20); // Draw spaceship as a rectangle
      });
    };

    const renderGame = () => {
      renderSpaceships();
      requestAnimationFrame(renderGame); // Continuously render spaceships
    };

    renderGame();

    return () => {
      // Cancel the animation frame on cleanup
      cancelAnimationFrame(starfieldAnimationRef.current);
    };
  }, [spaceships]); // Re-render when spaceships change

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

  const batchDrawOnCanvas = (history) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    history.forEach(({ x, y, prevX, prevY, color }) => {
      ctx.strokeStyle = color || "black";
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.closePath();
    });
  };

  const handleMouseDown = () => {
    isDrawing.current = true;
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const prevX = e.movementX ? x - e.movementX : x;
    const prevY = e.movementY ? y - e.movementY : y;

    // Draw locally
    drawOnCanvas(x, y, prevX, prevY);

    // Send drawing data to the server
    sendMessage({
      type: "draw",
      x,
      y,
      prevX,
      prevY,
      color: "black",
      username,
    });
  };

  const sendMessage = (message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not open. Message not sent:", message);
    }
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Prevent duplicate messages
    const trimmedMessage = message.trim();
    if (messages.length && messages[messages.length - 1].message === trimmedMessage) return;

    sendMessage({ type: "chat", message: trimmedMessage, username });
    setMessage(""); // Clear the input field
  };

  const handleKeyDown = (e) => {
    const movement = { username, type: "spaceship_update" };

    switch (e.key) {
      case "w":
        movement.direction = "up";
        break;
      case "s":
        movement.direction = "down";
        break;
      case "a":
        movement.direction = "left";
        break;
      case "d":
        movement.direction = "right";
        break;
      case "ArrowUp":
        movement.direction = "up";
        break;
      case "ArrowDown":
        movement.direction = "down";
        break;
      case "ArrowLeft":
        movement.direction = "left";
        break;
      case "ArrowRight":
        movement.direction = "right";
        break;
      default:
        return;
    }

    sendMessage(movement);
  };

  const handleIncrementCounter = () => {
    sendMessage({ type: "counter_increment" });
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container
        maxWidth="xl"
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
            width: "25%",
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
            width: "35%",
            height: "100%",
            border: "1px solid #ccc",
            borderRadius: "8px",
            position: "relative",
            backgroundColor: "#f5f5f5", // Lighter grey background
          }}
        >
          <Typography variant="h5" gutterBottom sx={{ textAlign: "center", color: "#333" }}>
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

        {/* Multiplayer Spaceship Game Section */}
        <Box
          sx={{
            width: "35%",
            height: "100%",
            border: "1px solid #ccc",
            borderRadius: "8px",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
          tabIndex={0} // Make the box focusable to capture key events
          onKeyDown={handleKeyDown}
        >
          <Typography variant="h5" gutterBottom sx={{ textAlign: "center" }}>
            Multiplayer Spaceship Game
          </Typography>
          <canvas
            ref={gameCanvasRef}
            width={800}
            height={500}
            style={{ width: "100%", height: "75%" }}
          />
          {/* Multiplayer Counter Section */}
          <Box
            sx={{
              width: "100%",
              height: "20%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderTop: "1px solid #ccc",
              padding: 2,
            }}
          >
            <Typography variant="h6" gutterBottom>
              Multiplayer Counter: {counter}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleIncrementCounter}
            >
              Increment Counter
            </Button>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
