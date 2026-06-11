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
 * acceptAllDevices: ファームウェアリビルド前はデバイス名が未確定なため全デバイスを表示する。
 * リビルド後は "mona2" という名前で一覧に表示される。
 * optionalServices は GATT 接続後にサービスへのアクセスを許可するために必須。
 */
export async function connectViaBluetooth(): Promise<RpcConnection> {
  const dev = await navigator.bluetooth
    .requestDevice({
      acceptAllDevices: true,
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
    await dev.gatt.connect().catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("NetworkError") || msg.includes("Unsupported")) {
        throw new Error(
          "Bluetooth GATT 接続に失敗しました。\n" +
          "macOS の Chrome では、すでに HID として接続済みのキーボードへの Web Bluetooth 接続がブロックされます。\n" +
          "USB ケーブルで接続して「USB で接続」をお使いください。"
        );
      }
      throw e;
    });
  }

  const svc = await dev.gatt.getPrimaryService(STUDIO_SERVICE_UUID).catch(() => {
    throw new Error(
      "ZMK Studio GATT サービスが見つかりません。\n" +
      "ファームウェアに CONFIG_ZMK_STUDIO=y が設定されているか確認してください。"
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
