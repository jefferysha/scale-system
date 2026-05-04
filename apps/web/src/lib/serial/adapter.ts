export type SerialErrorCode =
  | 'PERMISSION_DENIED'
  | 'PORT_NOT_FOUND'
  | 'PORT_BUSY'
  | 'OPEN_FAILED'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'IO_ERROR'
  | 'CLOSED_BY_DEVICE'
  | 'CANCELLED'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export interface SerialPortInfo {
  id: string;
  label: string;
  vendor?: string;
  product?: string;
}

export interface ScaleConfig {
  baudRate: number;
  dataBits: 7 | 8;
  parity: 'none' | 'even' | 'odd';
  stopBits: 1 | 2;
  flowControl: 'none' | 'hardware';
  protocolType: 'generic' | 'mettler' | 'sartorius' | 'ohaus';
  readTimeoutMs: number;
  decimalPlaces: number;
  unitDefault: 'g' | 'mg' | 'kg';
}

export interface WeightSample {
  value: number;
  unit: 'g' | 'mg' | 'kg';
  stable: boolean;
  raw: string;
  ts: number;
}

export type ConnectionState =
  | 'idle'
  | 'opening'
  | 'connected'
  | 'reading'
  | 'error'
  | 'disconnected';

export interface SerialError {
  code: SerialErrorCode;
  message: string;
}

export interface ProbeResult {
  ok: boolean;
  samples: WeightSample[];
  error?: SerialError;
}

export interface SerialAdapter {
  listPorts(): Promise<SerialPortInfo[]>;
  open(portId: string, config: ScaleConfig): Promise<void>;
  close(): Promise<void>;
  onWeight(handler: (s: WeightSample) => void): () => void;
  onStatus(handler: (s: ConnectionState) => void): () => void;
  onError(handler: (e: SerialError) => void): () => void;
  probe(portId: string, config: ScaleConfig, timeoutMs: number): Promise<ProbeResult>;
  isSupported(): boolean;
  /** Web Serial 专用：触发浏览器原生设备选择器。必须在用户手势内调用。 */
  requestPermission?(): Promise<SerialPortInfo | null>;
}
