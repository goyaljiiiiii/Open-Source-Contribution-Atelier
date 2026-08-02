import json

from channels.generic.websocket import AsyncWebsocketConsumer


class CeleryMonitorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated or not (user.is_staff or user.is_superuser):
            await self.close()
            return

        self.group_name = "celery_monitor"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def task_update(self, event):
        await self.send(text_data=json.dumps({"type": "task_update", "data": event["task_run"]}))
