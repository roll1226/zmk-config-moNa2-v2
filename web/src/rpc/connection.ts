import { connect as connectSerial } from "@zmkfirmware/zmk-studio-ts-client/transport/serial";
import {
  create_rpc_connection,
  type RpcConnection,
} from "@zmkfirmware/zmk-studio-ts-client";

export type { RpcConnection };

export async function connectViaUSB(): Promise<RpcConnection> {
  const transport = await connectSerial();
  return create_rpc_connection(transport);
}

// ZMK Studio GATT service / characteristic UUIDs
const STUDIO_SERVICE_UUID = "00000000-0196-6107-c967-c5cfb1c2482a";
const STUDIO_RPC_CHRC_UUID = "00000001-0196-6107-c967-c5cfb1c2482a";

/**
 * Connect via Web Bluetooth.
 * Uses name-based filters so only ZMK/mona2 devices appear in the picker.
 * optionalServices is required to access the GATT characteristic after pairing.
 */
export async function connectViaBluetooth(): Promise<RpcConnection> {
  const dev = await navigator.bluetooth
    .requestDevice({
      filters: [
        { name: "mona2" },          // after CONFIG_BT_DEVICE_NAME="mona2"
        { namePrefix: "ZMK" },      // ZMK default: "ZMK Keyboard"
        { services: [STUDIO_SERVICE_UUID] }, // if service UUID is advertised
      ],
      optionalServices: [STUDIO_SERVICE_UUID],
    })
    .catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "NotFoundError") {
        throw new Error("デバイスの選択がキャンセルされました");
      }
      throw e;
    });

  if (!dev.gatt) throw new Error("このデバイスは GATT をサポートしていません");

  const abortController = new AbortController();
  const label = dev.name ?? "Unknown";

  if (!dev.gatt.connected) {
    await dev.gatt.connect();
  }

  const svc = await dev.gatt.getPrimaryService(STUDIO_SERVICE_UUID).catch(() => {
    throw new Error(
      "ZMK Studio GATT サービスが見つかりません。ファームウェアの BLE 設定を確認してください。"
    );
  });
  const char = await svc.getCharacteristic(STUDIO_RPC_CHRC_UUID);

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      await char.stopNotifications();
      await char.startNotifications();

      const onValue = (ev: Event) => {
        const buf = (ev.target as BluetoothRemoteGATTCharacteristic).value
          ?.buffer;
        if (buf) controller.enqueue(new Uint8Array(buf));
      };

      const onDisconnect = () => {
        char.removeEventListener("characteristicvaluechanged", onValue);
        dev.removeEventListener("gattserverdisconnected", onDisconnect);
        controller.close();
      };

      char.addEventListener("characteristicvaluechanged", onValue);
      dev.addEventListener("gattserverdisconnected", onDisconnect);
    },
  });

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      // Cast needed: writeValueWithoutResponse expects ArrayBuffer, not ArrayBufferLike
      return char.writeValueWithoutResponse(chunk.buffer as ArrayBuffer);
    },
  });

  const sig = abortController.signal;
  const abortCb = () => {
    sig.removeEventListener("abort", abortCb);
    dev.gatt?.disconnect();
  };
  sig.addEventListener("abort", abortCb);

  return create_rpc_connection({ label, abortController, readable, writable });
}
