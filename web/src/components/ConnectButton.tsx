interface ConnectButtonProps {
  onConnectUSB: () => void;
  onConnectBluetooth: () => void;
  connecting: boolean;
  serialAvailable: boolean;
  bluetoothAvailable: boolean;
}

export function ConnectButton({
  onConnectUSB,
  onConnectBluetooth,
  connecting,
  serialAvailable,
  bluetoothAvailable,
}: ConnectButtonProps) {
  return (
    <div className="flex gap-2">
      {serialAvailable && (
        <button
          onClick={onConnectUSB}
          disabled={connecting}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg shadow transition-colors text-sm"
        >
          {connecting ? "接続中..." : "USB で接続"}
        </button>
      )}
      {bluetoothAvailable && (
        <div className="flex flex-col items-end gap-0.5">
          <button
            onClick={onConnectBluetooth}
            disabled={connecting}
            title="macOS + Chrome では HID 接続済みデバイスへの GATT 接続がブロックされる場合があります"
            className="px-5 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-purple-500 text-white font-semibold rounded-lg shadow transition-colors text-sm opacity-75"
          >
            {connecting ? "接続中..." : "Bluetooth で接続"}
          </button>
          <span className="text-xs text-gray-500">macOS では動作しない場合あり</span>
        </div>
      )}
    </div>
  );
}
