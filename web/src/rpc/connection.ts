import { connect as connectSerial } from "@zmkfirmware/zmk-studio-ts-client/transport/serial";
import { connect as connectGatt } from "@zmkfirmware/zmk-studio-ts-client/transport/gatt";
import {
  create_rpc_connection,
  type RpcConnection,
} from "@zmkfirmware/zmk-studio-ts-client";

export type { RpcConnection };

export async function connectViaUSB(): Promise<RpcConnection> {
  const transport = await connectSerial();
  return create_rpc_connection(transport);
}

export async function connectViaBluetooth(): Promise<RpcConnection> {
  const transport = await connectGatt();
  return create_rpc_connection(transport);
}
