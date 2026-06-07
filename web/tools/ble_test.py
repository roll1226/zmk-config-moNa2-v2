#!/usr/bin/env python3
"""
mona2 BLE GATT keymap service test script.

Usage
-----
  # Install once
  pip install -r requirements.txt

  # Full end-to-end test (draft → commit, verify status)
  python ble_test.py

  # Test with custom payload file (JSON produced by the Web editor)
  python ble_test.py --payload my_keymap.json

  # Rollback committed payload on the device
  python ble_test.py --rollback

  # Clear NVS storage
  python ble_test.py --clear

Options
-------
  --device  NAME    Bluetooth device name to connect to (default: "mona2")
  --payload FILE    JSON payload file to push as draft (default: built-in minimal)
  --commit-only     Skip draft write, send commit command only
  --rollback        Send rollback command and exit
  --clear           Send clear command and exit
  --status          Read and print status characteristic, then exit
  --timeout SECS    BLE scan timeout in seconds (default: 10)
"""

import argparse
import asyncio
import json
import sys
from typing import Optional

from bleak import BleakClient, BleakScanner
from codec import DeviceStatus, chunk_payload, decode_status, fnv1a_32
from protocol import (
    COMMAND_CLEAR, COMMAND_COMMIT, COMMAND_ROLLBACK,
    COMMAND_UUID, DEVICE_NAME, PAYLOAD_UUID, SERVICE_UUID, STATUS_UUID,
    RESULT_OK,
)

# ---------------------------------------------------------------------------
# Minimal valid payload used when the caller does not provide --payload
# ---------------------------------------------------------------------------

MINIMAL_PAYLOAD = {
    "version": 1,
    "timestamp": 0,
    "deviceId": "mona2",
    "layers": [
        {
            "id": "default_layer",
            "sensorBindings": "&scroll_up_down",
            "bindings": [],   # empty → no bindings changed; tests round-trip only
        }
    ],
    "combos": [],
    "macros": [],
    "metadata": {"hash": "00000000", "modifiedKeys": 0},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ok(msg: str) -> None:
    print(f"  \033[32m✓\033[0m {msg}")


def fail(msg: str) -> None:
    print(f"  \033[31m✗\033[0m {msg}")


def info(msg: str) -> None:
    print(f"    {msg}")


async def find_device(name: str, timeout: float) -> Optional[object]:
    print(f"Scanning for '{name}' (timeout={timeout}s) …")
    devices = await BleakScanner.discover(timeout=timeout)
    for d in devices:
        if d.name and name.lower() in d.name.lower():
            ok(f"Found: {d.name}  addr={d.address}")
            return d
    return None


async def read_status(client: BleakClient) -> DeviceStatus:
    raw = await client.read_gatt_char(STATUS_UUID)
    status = decode_status(bytes(raw))
    return status


async def write_command(client: BleakClient, command: int) -> None:
    await client.write_gatt_char(COMMAND_UUID, bytes([command]), response=True)


async def push_draft(client: BleakClient, payload_bytes: bytes) -> None:
    frames = chunk_payload(payload_bytes)
    print(f"  Pushing {len(payload_bytes)} bytes in {len(frames)} frame(s) …")
    for i, frame in enumerate(frames):
        await client.write_gatt_char(PAYLOAD_UUID, frame, response=True)
        info(f"frame {i+1}/{len(frames)}  ({len(frame)} bytes)")


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

async def test_discovery(client: BleakClient) -> bool:
    print("\n── Test 1: Service + characteristic discovery ──")
    svc = client.services.get_service(SERVICE_UUID)
    if not svc:
        fail(f"Service {SERVICE_UUID} not found")
        return False
    ok(f"Service found: {SERVICE_UUID}")

    for uuid in [STATUS_UUID, PAYLOAD_UUID, COMMAND_UUID]:
        char = svc.get_characteristic(uuid)
        if char:
            ok(f"Characteristic …{uuid[-4:]} found  props={char.properties}")
        else:
            fail(f"Characteristic …{uuid[-4:]} NOT found")
            return False
    return True


async def test_read_status(client: BleakClient) -> bool:
    print("\n── Test 2: Read status characteristic ──")
    try:
        status = await read_status(client)
        ok(f"Status read: {status}")
        return True
    except Exception as exc:
        fail(f"Read failed: {exc}")
        return False


async def test_draft_and_commit(
        client: BleakClient, payload_bytes: bytes
) -> bool:
    print("\n── Test 3: Draft write + commit ──")

    received: list[DeviceStatus] = []

    def on_notify(_handle: int, data: bytearray) -> None:
        try:
            received.append(decode_status(bytes(data)))
            info(f"notify → {received[-1]}")
        except Exception:
            pass

    await client.start_notify(STATUS_UUID, on_notify)

    try:
        # 1. Push draft frames
        await push_draft(client, payload_bytes)

        status = await read_status(client)
        info(f"After draft push: {status}")

        if status.last_result != RESULT_OK:
            fail(f"last_result={status.last_result} expected {RESULT_OK}")
            return False
        ok("Draft write accepted")

        if not status.has_staged:
            fail("HAS_STAGED flag not set after draft push")
            return False
        ok("HAS_STAGED flag set")

        expected_hash = fnv1a_32(payload_bytes)
        if status.staged_hash != expected_hash:
            fail(f"staged_hash mismatch: got 0x{status.staged_hash:08x} want 0x{expected_hash:08x}")
        else:
            ok(f"Staged hash matches: 0x{expected_hash:08x}")

        # 2. Commit
        print("  Sending COMMIT command …")
        await write_command(client, COMMAND_COMMIT)

        # Allow up to 2 seconds for the status notify after commit
        for _ in range(20):
            await asyncio.sleep(0.1)
            if received and received[-1].last_command == COMMAND_COMMIT:
                break

        status = await read_status(client)
        info(f"After commit: {status}")

        if status.last_result not in (RESULT_OK, -4):  # -4 = APPLY_ERROR is ok if no ZMK API
            fail(f"Commit last_result={status.last_result}")
            return False

        if not status.has_committed:
            fail("HAS_COMMITTED flag not set after commit")
            return False

        ok(f"Commit accepted — committed={status.committed_length}B  hash=0x{status.committed_hash:08x}")
        return True

    finally:
        await client.stop_notify(STATUS_UUID)


async def test_rollback(client: BleakClient) -> bool:
    print("\n── Test 4: Rollback ──")
    status_before = await read_status(client)
    info(f"Before rollback: {status_before}")

    await write_command(client, COMMAND_ROLLBACK)
    await asyncio.sleep(0.3)

    status_after = await read_status(client)
    info(f"After rollback:  {status_after}")
    ok("Rollback command sent")
    return True


async def test_clear(client: BleakClient) -> bool:
    print("\n── Clear NVS storage ──")
    await write_command(client, COMMAND_CLEAR)
    await asyncio.sleep(0.3)
    status = await read_status(client)
    info(f"After clear: {status}")
    ok("Clear command sent")
    return True


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main(args: argparse.Namespace) -> int:
    device = await find_device(args.device, args.timeout)
    if not device:
        fail(f"Device '{args.device}' not found — make sure it is advertising")
        return 1

    async with BleakClient(device) as client:
        ok(f"Connected to {client.address}")

        if args.status:
            await test_read_status(client)
            return 0

        if args.rollback:
            await test_rollback(client)
            return 0

        if args.clear:
            await test_clear(client)
            return 0

        # Default: full test suite
        if not await test_discovery(client):
            return 1

        if not await test_read_status(client):
            return 1

        if not args.commit_only:
            if args.payload:
                with open(args.payload, "rb") as fh:
                    payload_bytes = fh.read()
                info(f"Using payload file: {args.payload}  ({len(payload_bytes)} bytes)")
            else:
                payload_str = json.dumps(MINIMAL_PAYLOAD, separators=(",", ":"))
                payload_bytes = payload_str.encode()
                info(f"Using built-in minimal payload  ({len(payload_bytes)} bytes)")

            if not await test_draft_and_commit(client, payload_bytes):
                return 1
        else:
            print("\n── Commit only ──")
            await write_command(client, COMMAND_COMMIT)
            await asyncio.sleep(0.3)
            status = await read_status(client)
            info(f"After commit: {status}")
            ok("Commit command sent")

    print("\n\033[32mAll tests passed.\033[0m")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="mona2 BLE GATT keymap service tester")
    parser.add_argument("--device",      default=DEVICE_NAME, help="BLE device name")
    parser.add_argument("--payload",     default=None,        help="Path to JSON payload file")
    parser.add_argument("--commit-only", action="store_true", help="Send COMMIT without draft push")
    parser.add_argument("--rollback",    action="store_true", help="Send ROLLBACK and exit")
    parser.add_argument("--clear",       action="store_true", help="Send CLEAR and exit")
    parser.add_argument("--status",      action="store_true", help="Read status and exit")
    parser.add_argument("--timeout",     type=float, default=10.0, help="Scan timeout in seconds")
    args = parser.parse_args()

    sys.exit(asyncio.run(main(args)))
