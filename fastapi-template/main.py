from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from models import MsgPayload
import json

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],  # Frontend origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

messages_list: dict[int, MsgPayload] = {}
counter = {"value": 0}  # Counter state

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        disconnected_clients = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Mark the client as disconnected
                disconnected_clients.append(connection)
        
        # Remove disconnected clients from the active connections list
        for client in disconnected_clients:
            self.disconnect(client)

manager = ConnectionManager()

@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Hello"}


# About page route
@app.get("/about")
def about() -> dict[str, str]:
    return {"message": "This is the about page."}


# Route to add a message
@app.post("/messages/{msg_name}")
def add_msg(msg_name: str) -> dict[str, MsgPayload]:
    # Generate an ID for the item based on the highest ID in the messages_list
    msg_id = max(messages_list.keys()) + 1 if messages_list else 0
    messages_list[msg_id] = MsgPayload(msg_id=msg_id, msg_name=msg_name)

    # Log the message to the console
    print(f"Received message: {msg_name}")

    return {"message": messages_list[msg_id]}


# Route to list all messages
@app.get("/messages")
def message_items() -> dict[str, dict[int, MsgPayload]]:
    return {"messages:": messages_list}


# Route to get the current counter value
@app.get("/counter")
def get_counter() -> dict[str, int]:
    return {"value": counter["value"]}


# Route to increment the counter
@app.post("/counter/increment")
def increment_counter() -> dict[str, int]:
    counter["value"] += 1
    return {"value": counter["value"]}


planes = {}  # Store planes' positions

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            data = json.loads(data)

            if data["type"] == "plane_update":
                username = data["username"]
                if username not in planes:
                    planes[username] = {"x": 400, "y": 300, "username": username}  # Initialize plane position

                if data["direction"] == "up":
                    planes[username]["y"] -= 10
                elif data["direction"] == "down":
                    planes[username]["y"] += 10
                elif data["direction"] == "left":
                    planes[username]["x"] -= 10
                elif data["direction"] == "right":
                    planes[username]["x"] += 10

                # Broadcast updated planes to all clients
                await manager.broadcast(json.dumps({"type": "plane_update", "planes": planes}))
            else:
                # Broadcast other data (chat or drawing)
                await manager.broadcast(json.dumps(data))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Remove the disconnected user's plane
        username_to_remove = None
        for username, plane in list(planes.items()):
            if plane["username"] == websocket.client:
                username_to_remove = username
                break
        if username_to_remove:
            del planes[username_to_remove]
        await manager.broadcast(json.dumps({"type": "plane_update", "planes": planes}))
