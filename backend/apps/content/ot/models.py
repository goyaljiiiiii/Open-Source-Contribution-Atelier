from __future__ import annotations

import dataclasses
from typing import List, Union


@dataclasses.dataclass(frozen=True)
class Retain:
    count: int


@dataclasses.dataclass(frozen=True)
class Insert:
    text: str


@dataclasses.dataclass(frozen=True)
class Delete:
    count: int


OpComponent = Union[Retain, Insert, Delete]
Operation = List[OpComponent]
