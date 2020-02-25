from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Board


class BoardWSConsumer(AsyncJsonWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.board_id = None

    async def connect(self):
        try:
            self.board_id = (
                self.scope.get("url_route", {}).get("kwargs", {}).get("board_id")
            )
            self.group_name = f"board-{self.board_id}"
        except KeyError:
            await self.close()
        else:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            await self.init_data()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, data):
        # Incomming messages:
        # {type: FOO, data: {...}}
        type = data.get("type")
        if not type:
            return
        if type == "ADD_PATH":
            # {type: ADD_PATH, data: {points: [], color: foo, ...}}
            path_data = data.get("data")
            add_path = database_sync_to_async(Board.add_path)
            new_version = await add_path(self.board_id, path_data)
            # broadcast to other clients
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_path",
                    "message": {
                        "type": "REMOTE_CHANGE",
                        "data": {"path": path_data, "version": new_version,},
                        "from": self.channel_name,
                    },
                },
            )
            await self.send_json({"type": "ACK", "data": {"version": new_version}})
        if type == "REQ_INIT":
            # await self.send_json({})
            await self.init_data()

    async def broadcast_path(self, event):
        # don't mutate message;
        message = event["message"]
        if message["from"] == self.channel_name:
            return
        await self.send_json({"type": message["type"], "data": message["data"]})

    async def init_data(self):
        await self.send_json(
            {
                "type": "INIT",
                "data": await database_sync_to_async(Board.get_board_data)(
                    self.board_id
                ),
            }
        )
