"""Abstract base repository.

Provides a consistent interface so callers (API routes) never touch SQLAlchemy
directly. Swap the concrete implementation to change the data source.
"""
from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import AsyncSession


class BaseRepository(ABC):
    def __init__(self, session: AsyncSession):
        self.session = session
