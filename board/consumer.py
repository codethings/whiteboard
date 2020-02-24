from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Board


class BoardWSConsumer(AsyncJsonWebsocketConsumer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.board_id = None

    async def connect(self):
        try:
            self.board_id = self.scope.get("url_route", {}).get("kwargs", {}).get("board_id")
        except KeyError:
            await self.close()
        else:
            await self.accept()
            await self.init_data()
    
    async def disconnect(self, close_code):
        pass

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
            await add_path(self.board_id, path_data)

    async def init_data(self):
        await self.send_json({
            "type": "INIT",
            "data": await database_sync_to_async(Board.get_board_data)(self.board_id)
        })
