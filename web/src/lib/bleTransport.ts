import type { BluetoothSupport, DeviceStatus } from "../types";
import { chunkDraftPayload, decodeDeviceStatus } from "./keymapPayloadCodec";

export const MONA2_KEYMAP_SERVICE_UUID = "12ab0001-8b1f-4f9f-9f64-0fd8b7f56d01";
export const MONA2_KEYMAP_STATUS_UUID = "12ab0002-8b1f-4f9f-9f64-0fd8b7f56d01";
export const MONA2_KEYMAP_PAYLOAD_UUID = "12ab0003-8b1f-4f9f-9f64-0fd8b7f56d01";
export const MONA2_KEYMAP_COMMAND_UUID = "12ab0004-8b1f-4f9f-9f64-0fd8b7f56d01";

export const MONA2_COMMAND_COMMIT = 1;
export const MONA2_COMMAND_ROLLBACK = 2;
export const MONA2_COMMAND_CLEAR = 3;

export class BleTransport {
  private device: BluetoothDevice | null = null;
  private statusCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private payloadCharacteristic: BluetoothRemoteGATTCharacteristic | null =
    null;
  private commandCharacteristic: BluetoothRemoteGATTCharacteristic | null =
    null;
  private statusListeners: Array<(status: DeviceStatus) => void> = [];

  getSupport(): BluetoothSupport {
    if (!("bluetooth" in navigator)) {
      return {
        available: false,
        message:
          "このブラウザでは Web Bluetooth が使えません。Chrome 系ブラウザか companion app が必要です。",
      };
    }

    return {
      available: true,
      message:
        "BLE 接続を試せます。カスタム GATT サービスに接続して draft/commit を実行できます。",
    };
  }

  isConnected(): boolean {
    return Boolean(
      this.device?.gatt?.connected &&
      this.payloadCharacteristic &&
      this.commandCharacteristic,
    );
  }

  getConnectedDeviceName(): string | null {
    return this.device?.name ?? null;
  }

  onStatus(listener: (status: DeviceStatus) => void): void {
    this.statusListeners.push(listener);
  }

  private emitStatus(status: DeviceStatus): void {
    this.statusListeners.forEach((listener) => listener(status));
  }

  async requestDevice(): Promise<BluetoothDevice> {
    if (!("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth is not available in this browser.");
    }

    // Service UUID filter alone hides the popup when the device hasn't been
    // flashed with the new firmware yet.  Add a name filter so the mona2
    // device is always listed regardless of firmware version.
    // optionalServices keeps access to the custom GATT service once available.
    return navigator.bluetooth.requestDevice({
      filters: [{ services: [MONA2_KEYMAP_SERVICE_UUID] }, { name: "mona2" }],
      optionalServices: [MONA2_KEYMAP_SERVICE_UUID],
    });
  }

  async connect(): Promise<BluetoothDevice> {
    const device = await this.requestDevice();
    if (!device.gatt) {
      // Device selected but GATT not available — store the device reference
      // so the UI can at least show the name.
      this.device = device;
      throw new Error(
        `デバイス "${device.name ?? device.id}" を選択しましたが GATT が利用できません。新ファームウェアを書き込んだ後に再接続してください。`,
      );
    }

    const server = await device.gatt.connect();

    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(MONA2_KEYMAP_SERVICE_UUID);
    } catch {
      this.device = device;
      throw new Error(
        `デバイス "${device.name ?? device.id}" に接続しましたが mona2 keymap service が見つかりません。新ファームウェアを書き込んだ後に再接続してください。`,
      );
    }

    this.statusCharacteristic = await service.getCharacteristic(
      MONA2_KEYMAP_STATUS_UUID,
    );
    this.payloadCharacteristic = await service.getCharacteristic(
      MONA2_KEYMAP_PAYLOAD_UUID,
    );
    this.commandCharacteristic = await service.getCharacteristic(
      MONA2_KEYMAP_COMMAND_UUID,
    );
    this.device = device;

    await this.statusCharacteristic.startNotifications();
    this.statusCharacteristic.addEventListener(
      "characteristicvaluechanged",
      (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic | null;
        if (!target?.value) {
          return;
        }

        this.emitStatus(decodeDeviceStatus(target.value));
      },
    );

    return device;
  }

  async readStatus(): Promise<DeviceStatus> {
    if (!this.statusCharacteristic) {
      throw new Error("BLE status characteristic is not available.");
    }

    const value = await this.statusCharacteristic.readValue();
    const status = decodeDeviceStatus(value);
    this.emitStatus(status);
    return status;
  }

  async writeDraftPayload(
    payload: Uint8Array,
    chunkSize: number,
  ): Promise<void> {
    if (!this.payloadCharacteristic) {
      throw new Error("BLE payload characteristic is not available.");
    }

    for (const frame of chunkDraftPayload(payload, chunkSize)) {
      const buffer = new ArrayBuffer(frame.byteLength);
      new Uint8Array(buffer).set(frame);
      await this.payloadCharacteristic.writeValueWithResponse(buffer);
    }
  }

  async commitDraft(): Promise<void> {
    await this.writeCommand(MONA2_COMMAND_COMMIT);
  }

  async rollbackDraft(): Promise<void> {
    await this.writeCommand(MONA2_COMMAND_ROLLBACK);
  }

  async clearCommitted(): Promise<void> {
    await this.writeCommand(MONA2_COMMAND_CLEAR);
  }

  private async writeCommand(command: number): Promise<void> {
    if (!this.commandCharacteristic) {
      throw new Error("BLE command characteristic is not available.");
    }

    await this.commandCharacteristic.writeValueWithResponse(
      Uint8Array.of(command),
    );
  }
}
