import QRCode from 'qrcode';
import { WindscribeGroup, WindscribeLocation } from '../types/vpn';

export function generateWireGuardConfig(group: WindscribeGroup, location: WindscribeLocation): string {
  const endpoint = group.wg_endpoint || `${group.city.toLowerCase().replace(/\s+/g, '-')}.whiskergalaxy.com`;
  const pubkey = group.wg_pubkey || 'pASG4FD9LwOfJukT/wYbUF10gD6v8DVuv5hrNbiOnHQ=';

  return `[Interface]
# Windscribe AutoScribe Profile
# Location: ${location.name} - ${group.city} (${group.nick})
# Protocol: WireGuard
PrivateKey = CLIENT_PRIVATE_KEY_HERE (Paste from Windscribe Account > WireGuard)
Address = 10.126.12.5/32
DNS = 10.255.255.1

[Peer]
# Server: ${endpoint}
PublicKey = ${pubkey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}:443
PersistentKeepalive = 25
`;
}

export function generateOpenVPNConfig(group: WindscribeGroup, location: WindscribeLocation, protocol: 'udp' | 'tcp' = 'udp'): string {
  const host = group.ovpn_x509 || `${group.city.toLowerCase().replace(/\s+/g, '-')}.windscribe.com`;
  const port = protocol === 'udp' ? 443 : 1194;

  return `# Windscribe AutoScribe OpenVPN Profile
# Location: ${location.name} - ${group.city} (${group.nick})
client
dev tun
proto ${protocol}
remote ${host} ${port}
nobind
persist-key
persist-tun
auth-user-pass
auth-nocache
remote-cert-tls server
cipher AES-256-GCM
auth SHA512
verb 3
fast-io
compress lz4-v2
`;
}

export async function generateQrCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 320,
      margin: 2,
      color: {
        dark: '#030712',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}

export function getWindscribeCliCommand(location: WindscribeLocation, group?: WindscribeGroup): string {
  if (group && group.city) {
    return `windscribe-cli connect "${location.name}" "${group.city}"`;
  }
  return `windscribe-cli connect "${location.name}"`;
}
