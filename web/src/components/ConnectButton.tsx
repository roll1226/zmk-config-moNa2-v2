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
        <button
          onClick={onConnectBluetooth}
          disabled={connecting}
          className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-lg shadow transition-colors text-sm"
        >
          {connecting ? "接続中..." : "Bluetooth で接続"}
        </button>
      )}
    </div>
  );
}
