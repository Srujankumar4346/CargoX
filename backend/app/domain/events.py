from typing import Callable, Dict, List, Any
from sqlalchemy.orm import Session
from pydantic import BaseModel

class DomainEvent(BaseModel):
    event_type: str
    entity_id: Any
    payload: dict = {}

class EventDispatcher:
    _subscribers: Dict[str, List[Callable]] = {}

    @classmethod
    def subscribe(cls, event_type: str, handler: Callable):
        if event_type not in cls._subscribers:
            cls._subscribers[event_type] = []
        cls._subscribers[event_type].append(handler)

    @classmethod
    def publish(cls, db: Session, event: DomainEvent):
        handlers = cls._subscribers.get(event.event_type, [])
        for handler in handlers:
            handler(db, event)

event_dispatcher = EventDispatcher()
