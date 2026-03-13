"""Abstract DataLoader interface.

Swap implementations to change data sources without touching the seed runner
or the API. A loader just needs to return plain dicts matching the seed schema.
"""
from abc import ABC, abstractmethod


class DataLoader(ABC):
    @abstractmethod
    def load_countries(self) -> list[dict]:
        ...

    @abstractmethod
    def load_chokepoints(self) -> list[dict]:
        ...

    @abstractmethod
    def load_infrastructures(self) -> list[dict]:
        ...

    @abstractmethod
    def load_flows(self) -> list[dict]:
        ...

    @abstractmethod
    def load_scenarios(self) -> list[dict]:
        ...
