import React, { useEffect, useState } from 'react';
import { WindscribeGroup, WindscribeLocation } from '../types/vpn';
import { generateWireGuardConfig, generateOpenVPNConfig, generateQrCodeDataUrl, getWindscribeCliCommand } from '../utils/configGenerator';
import { X, Copy, Check, Download, QrCode, Terminal, Shield, FileText } from 'lucide-react';

interface ConfigModalProps {
  location: WindscribeLocation;
  group: WindscribeGroup;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ location, group, onClose }) => {
  const [tab, setTab] = useState<'wireguard' | 'openvpn' | 'cli'>('wireguard');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const wgConfig = generateWireGuardConfig(group, location);
  const ovpnConfig = generateOpenVPNConfig(group, location, 'udp');
  const cliCommand = getWindscribeCliCommand(location, group);

  useEffect(() => {
    if (tab === 'wireguard') {
      generateQrCodeDataUrl(wgConfig).then(setQrCodeUrl);
    }
  }, [tab, wgConfig]);

  const currentContent = tab === 'wireguard' ? wgConfig : tab === 'openvpn' ? ovpnConfig : cliCommand;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = tab === 'wireguard' ? 'conf' : tab === 'openvpn' ? 'ovpn' : 'sh';
    const filename = `windscribe-${group.city.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
    const blob = new Blob([currentContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{group.city}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {group.nick}
                </span>
                {group.pro === 0 ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold uppercase">
                    Free Tier
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold uppercase">
                    Pro Node
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{location.name} • Endpoint: {group.wg_endpoint || 'Auto'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-900/50">
          <button
            onClick={() => setTab('wireguard')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              tab === 'wireguard'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            WireGuard (.conf)
          </button>
          <button
            onClick={() => setTab('openvpn')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              tab === 'openvpn'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            OpenVPN (.ovpn)
          </button>
          <button
            onClick={() => setTab('cli')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              tab === 'cli'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            CLI Command
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {tab === 'wireguard' && qrCodeUrl && (
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="bg-white p-2.5 rounded-xl shadow-lg shrink-0">
                <img src={qrCodeUrl} alt="WireGuard QR Code" className="w-36 h-36" />
              </div>
              <div className="text-left space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                  <QrCode className="w-4 h-4" />
                  <span>Instant Android Import</span>
                </div>
                <p className="text-slate-300">
                  Open the official <strong>WireGuard Android App</strong>, tap <span className="text-cyan-400 font-mono">+</span>, and select <strong>Scan from QR code</strong> to connect immediately.
                </p>
                <p className="text-slate-500 text-[11px]">
                  Requires WireGuard private key from your Windscribe account dashboard.
                </p>
              </div>
            </div>
          )}

          {tab === 'cli' && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold">
                <Terminal className="w-4 h-4" />
                <span>Termux / Linux CLI Execution</span>
              </div>
              <p>
                Execute this in your Android Termux shell or desktop terminal to connect directly via Windscribe CLI:
              </p>
            </div>
          )}

          {/* Code Viewer */}
          <div className="relative rounded-xl bg-slate-950 border border-slate-800 overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/60 text-slate-400 text-[11px]">
              <span>{tab === 'wireguard' ? 'wireguard.conf' : tab === 'openvpn' ? 'openvpn.ovpn' : 'bash-command'}</span>
              <span>UTF-8</span>
            </div>
            <pre className="p-4 text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-56">
              {currentContent}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Config'}</span>
          </button>

          {tab !== 'cli' && (
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-bold text-black transition shadow-md shadow-cyan-500/20 active:scale-95"
            >
              <Download className="w-4 h-4 text-black" />
              <span>Download File</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
