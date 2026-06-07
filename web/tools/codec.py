"""Frame encoding / status decoding utilities."""

import struct
from dataclasses import dataclass
from typing import List

from protocol import (
    CHUNK_SIZE, FRAME_OPCODE_DRAFT, PROTOCOL_VERSION,
    STATUS_HAS_COMMITTED, STATUS_HAS_STAGED, STATUS_READY, STATUS_STAGED_DIRTY,
)


@dataclass
class DeviceStatus:
    version: int
    flags: int
    last_command: int
    last_result: int
    staged_length: int
    committed_length: int
    staged_hash: int
    committed_hash: int

    @property
    def ready(self) -> bool:
        return bool(self.flags & STATUS_READY)

    @property
    def has_committed(self) -> bool:
        return bool(self.flags & STATUS_HAS_COMMITTED)

    @property
    def has_staged(self) -> bool:
        return bool(self.flags & STATUS_HAS_STAGED)

    @property
    def staged_dirty(self) -> bool:
        return bool(self.flags & STATUS_STAGED_DIRTY)

    def __str__(self) -> str:
        return (
            f"DeviceStatus(flags=0x{self.flags:02x} "
            f"ready={self.ready} committed={self.has_committed} "
            f"staged={self.has_staged} dirty={self.staged_dirty} "
            f"last_result={self.last_result} "
            f"staged={self.staged_length}B committed={self.committed_length}B)"
        )


def decode_status(data: bytes) -> DeviceStatus:
    """Decode the 16-byte status characteristic value."""
    if len(data) < 16:
        raise ValueError(f"status too short: {len(data)} < 16 bytes")

    version, flags, last_cmd, last_result, staged_len, committed_len, staged_hash, committed_hash = \
        struct.unpack_from("<BBBbHHII", data)

    return DeviceStatus(
        version=version,
        flags=flags,
        last_command=last_cmd,
        last_result=last_result,
        staged_length=staged_len,
        committed_length=committed_len,
        staged_hash=staged_hash,
        committed_hash=committed_hash,
    )


def fnv1a_32(data: bytes) -> int:
    h = 0x811C9DC5
    for byte in data:
        h = ((h ^ byte) * 0x01000193) & 0xFFFFFFFF
    return h


def chunk_payload(payload: bytes, chunk_size: int = CHUNK_SIZE) -> List[bytes]:
    """Split payload into framed chunks ready for GATT write."""
    frames: List[bytes] = []
    total = len(payload)

    for offset in range(0, total, chunk_size):
        chunk = payload[offset:offset + chunk_size]
        header = struct.pack(
            "<BBHHH",
            PROTOCOL_VERSION,
            FRAME_OPCODE_DRAFT,
            offset,
            total,
            len(chunk),
        )
        frames.append(header + chunk)

    return frames
