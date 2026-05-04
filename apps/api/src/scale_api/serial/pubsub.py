"""进程内 pub/sub：让 N 个 WebSocket 客户端同时订阅同一台天平的事件流。

为什么不用 Redis：单进程 API 内部广播没必要外部依赖；如果以后扩到多 worker
要共享流，再换 Redis pub/sub。
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any


@dataclass
class Event:
    type: str  # 'sample' | 'status' | 'error'
    payload: dict[str, Any]


class Topic:
    """单个主题（一台 scale 一个 topic）。每个订阅者拿到独立队列。"""

    def __init__(self, name: str) -> None:
        self.name = name
        self._subscribers: set[asyncio.Queue[Event]] = set()

    def publish(self, event: Event) -> None:
        # 即时投递：put_nowait，避免 await 让发布慢的订阅阻塞所有人
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # 慢消费者就丢最旧一帧腾位置
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass

    async def subscribe(self) -> AsyncIterator[Event]:
        """长连接消费者用 async-for 接事件流。"""
        q: asyncio.Queue[Event] = asyncio.Queue(maxsize=128)
        self._subscribers.add(q)
        try:
            while True:
                yield await q.get()
        finally:
            self._subscribers.discard(q)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


class TopicRegistry:
    """全局主题注册：scale_id → Topic。"""

    def __init__(self) -> None:
        self._topics: dict[int, Topic] = {}

    def get(self, scale_id: int) -> Topic:
        topic = self._topics.get(scale_id)
        if topic is None:
            topic = Topic(f"scale-{scale_id}")
            self._topics[scale_id] = topic
        return topic


_registry: TopicRegistry | None = None


def get_topic_registry() -> TopicRegistry:
    global _registry
    if _registry is None:
        _registry = TopicRegistry()
    return _registry
