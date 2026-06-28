import json

from channels.generic.websocket import AsyncWebsocketConsumer


class SandboxConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "sandbox_group"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            action = text_data_json.get("action")

            if action == "code_update":
                code = text_data_json.get("code")
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "code_message",
                        "code": code,
                        "sender_channel_name": self.channel_name,
                    },
                )
            elif action == "execute_code":
                code = text_data_json.get("code")
                from .services import stream_python_execution

                user_id = "anonymous"
                if self.scope.get("user") and getattr(self.scope["user"], "is_authenticated", False):
                    user_id = str(self.scope["user"].id)
                else:
                    user_id = self.channel_name

                async def send_callback(message_data):
                    await self.send(text_data=json.dumps(message_data))

                await stream_python_execution(code, send_callback, user_id=user_id)
        except Exception:
            pass

    async def code_message(self, event):
        code = event["code"]
        sender_channel_name = event.get("sender_channel_name")

        if self.channel_name != sender_channel_name:
            await self.send(
                text_data=json.dumps({"action": "code_update", "code": code})
            )
