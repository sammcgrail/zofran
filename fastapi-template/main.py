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
drawing_history = []  # Store drawing actions

class ConnectionManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()  # Use a set for faster operations

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)  # Use discard to avoid KeyError

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):  # Convert to list to avoid modification during iteration
            try:
                await connection.send_text(message)
            except Exception:
                self.disconnect(connection)  # Remove disconnected clients

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


spaceships = {}  # Store spaceships' positions

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial state to the newly connected client
        await websocket.send_text(json.dumps({"type": "counter_update", "value": counter["value"]}))
        if drawing_history:
            await websocket.send_text(json.dumps({"type": "drawing_history", "history": drawing_history}))
        if spaceships:
            await websocket.send_text(json.dumps({"type": "spaceship_update", "spaceships": spaceships}))

        while True:
            data = await websocket.receive_text()
            data = json.loads(data)

            if data["type"] == "spaceship_update":
                username = data["username"]
                spaceships.setdefault(username, {"x": 400, "y": 300, "username": username})  # Initialize if not exists

                if data["direction"] == "up":
                    spaceships[username]["y"] -= 10
                elif data["direction"] == "down":
                    spaceships[username]["y"] += 10
                elif data["direction"] == "left":
                    spaceships[username]["x"] -= 10
                elif data["direction"] == "right":
                    spaceships[username]["x"] += 10

                await manager.broadcast(json.dumps({"type": "spaceship_update", "spaceships": spaceships}))
            elif data["type"] == "counter_increment":
                counter["value"] += 1
                await manager.broadcast(json.dumps({"type": "counter_update", "value": counter["value"]}))
            elif data["type"] == "draw":
                drawing_history.append(data)
                await manager.broadcast(json.dumps(data))
            elif data["type"] == "chat":
                # Broadcast chat messages
                await manager.broadcast(json.dumps(data))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Remove the disconnected user's spaceship
        username_to_remove = None
        for username, spaceship in list(spaceships.items()):
            if username == websocket.client.host:  # Match the username with the client's host
                username_to_remove = username
                break
        if username_to_remove:
            del spaceships[username_to_remove]
        await manager.broadcast(json.dumps({"type": "spaceship_update", "spaceships": spaceships}))
