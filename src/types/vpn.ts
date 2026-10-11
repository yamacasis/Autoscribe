export interface WindscribeGroup {
  id: number;
  city: string;
  nick: string;
  pro: number;
  gps?: string;
  tz?: string;
  wg_pubkey?: string;
  wg_endpoint?: string;
  ovpn_x509?: string;
  ping_ip?: string;
  link_speed?: string;
}

export interface WindscribeLocation {
  id: number;
  name: string;
  country_code: string;
  status: number;
  premium_only: number;
  short_name: string;
  dns_hostname?: string;
  groups: WindscribeGroup[];
}

export interface NodePingResult {
  nodeId: number;
  city: string;
  nick: string;
  countryCode: string;
  ip: string;
  pingMs: number | null;
  status: 'idle' | 'testing' | 'success' | 'failed';
  downloadMbps?: number;
  uploadMbps?: number;
  testedAt?: number;
}

export interface SpeedTestState {
  isRunning: boolean;
  phase: 'idle' | 'ping' | 'download' | 'upload' | 'complete';
  targetCity: string;
  currentMbps: number;
  progressPercent: number;
  results: {
    pingMs: number;
    jitterMs: number;
    downloadMbps: number;
    uploadMbps: number;
    packetLossPercent: number;
    serverLocation: string;
    timestamp: number;
  } | null;
}

export type ActiveTab = 'locations' | 'benchmark' | 'cli' | 'termux' | 'configs';
