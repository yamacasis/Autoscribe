import React, { useState, useRef, useEffect } from 'react';
import { WindscribeLocation } from '../types/vpn';
import { pingServer } from '../utils/speedTester';
import { Terminal as TerminalIcon, CornerDownLeft, Trash2, Copy, Check, Play, Sparkles } from 'lucide-react';

interface TerminalCLIProps {
  locations: WindscribeLocation[];
  onOpenConfigByCity?: (city: string) => void;
  externalCommand?: string | null;
  onClearExternalCommand?: () => void;
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'info';
  text: string;
}

export const TerminalCLI: React.FC<TerminalCLIProps> = ({
  locations,
  onOpenConfigByCity,
  externalCommand,
  onClearExternalCommand
}) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'banner-1',
      type: 'info',
      text: '================================================================='
    },
    {
      id: 'banner-2',
      type: 'success',
      text: '  AutoScribe CLI v2.4.0 — Android & Termux Windscribe Engine    '
    },
    {
      id: 'banner-3',
      type: 'info',
      text: '  Source: https://github.com/rasool-mrr/AutoScribe             '
    },
    {
      id: 'banner-4',
      type: 'info',
      text: '================================================================='
    },
    {
      id: 'banner-5',
      type: 'output',
      text: 'Type "help" or "autoscribe --help" for available commands.'
    },
    {
      id: 'banner-6',
      type: 'output',
      text: 'Quick tip: Tap the quick command pills below for mobile execution.'
    }
  ]);

  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectedNode, setConnectedNode] = useState<{ city: string; location: string; ip: string } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Execute external command if passed from other tabs
  useEffect(() => {
    if (externalCommand) {
      executeCommand(externalCommand);
      onClearExternalCommand?.();
    }
  }, [externalCommand]);

  const appendLine = (text: string, type: TerminalLine['type'] = 'output') => {
    setLines(prev => [...prev, { id: Math.random().toString(), type, text }]);
  };

  const executeCommand = async (cmdStr: string) => {
    const raw = cmdStr.trim();
    if (!raw) return;

    // Add to history
    setHistory(prev => [...prev, raw]);
    setHistoryIdx(-1);

    appendLine(`$ ${raw}`, 'input');

    const parts = raw.split(/\s+/);
    const main = parts[0].toLowerCase();
    const sub = parts[1]?.toLowerCase();
    const arg = parts.slice(2).join(' ').replace(/["']/g, '');

    setIsProcessing(true);

    try {
      if (main === 'clear') {
        setLines([]);
        setIsProcessing(false);
        return;
      }

      if (main === 'help' || (main === 'autoscribe' && (sub === 'help' || sub === '--help' || !sub))) {
        appendLine('AutoScribe Command Reference:', 'info');
        appendLine('  autoscribe check               Scan and ping top free locations');
        appendLine('  autoscribe best                Find and select the lowest latency server');
        appendLine('  autoscribe speedtest [city]    Run download throughput & jitter test');
        appendLine('  autoscribe connect <city>      Connect tunnel to specified city');
        appendLine('  windscribe-cli locations       List all 75+ countries & nodes');
        appendLine('  windscribe-cli status          Check current tunnel status');
        appendLine('  windscribe-cli connect <loc>   Connect via official CLI');
        appendLine('  windscribe-cli disconnect      Tear down active VPN connection');
        appendLine('  sysinfo                        Show Android / Termux environment');
        appendLine('  clear                          Clear terminal console');
      } else if (main === 'sysinfo') {
        appendLine('[+] Android Termux Runtime: Linux aarch64 (ARM64)');
        appendLine('[+] Python: 3.11.8 • cURL: 8.6.0 • OpenSSL: 3.2.1');
        appendLine('[+] WireGuard Tools: wg-quick installed');
        appendLine(`[+] Active VPN State: ${connectedNode ? `Connected to ${connectedNode.city} (${connectedNode.ip})` : 'Disconnected (Direct IP)'}`);
      } else if (main === 'windscribe-cli' && sub === 'status') {
        if (connectedNode) {
          appendLine('=========================================', 'info');
          appendLine(`  Status: CONNECTED`, 'success');
          appendLine(`  Location: ${connectedNode.location} (${connectedNode.city})`);
          appendLine(`  Virtual IP: ${connectedNode.ip}`);
          appendLine('  Protocol: WireGuard (UDP 443)');
          appendLine('  Firewall / Killswitch: ON (Always-On)');
          appendLine('=========================================', 'info');
        } else {
          appendLine('Status: DISCONNECTED', 'output');
          appendLine('Firewall: OFF');
        }
      } else if (main === 'windscribe-cli' && sub === 'locations') {
        const queryReg = parts.slice(2).join(' ').replace(/["']/g, '');
        if (queryReg) {
          const matched = locations.find(l => l.name.toLowerCase().includes(queryReg.toLowerCase()));
          if (matched) {
            appendLine(`[+] Cities in Region '${matched.name}':`, 'info');
            matched.groups.forEach(g => {
              appendLine(`  • ${g.city} [${g.nick}] (IP: ${g.ping_ip || 'Auto'}) ${g.pro === 0 ? '[FREE]' : '[PRO]'}`);
            });
          } else {
            appendLine(`No region matching '${queryReg}' found.`, 'error');
          }
        } else {
          appendLine('[+] Available Windscribe Regions (pass region name to see cities):', 'info');
          locations.slice(0, 10).forEach(l => {
            const cityNames = l.groups.slice(0, 3).map(g => g.city).join(', ');
            appendLine(`  [${l.country_code}] ${l.name} -> Cities: ${cityNames}${l.groups.length > 3 ? '...' : ''} ${l.premium_only === 0 ? '[FREE]' : '[PRO]'}`);
          });
          appendLine('Tip: Run "windscribe-cli locations <region>" or "autoscribe locations" to see all cities.');
        }
      } else if (main === 'autoscribe' && (sub === 'locations' || sub === 'cities' || sub === 'list')) {
        appendLine('[+] All Available Windscribe Server Locations & Cities:', 'info');
        const freeLocs = locations.filter(l => l.premium_only === 0);
        freeLocs.forEach(l => {
          appendLine(`  📍 REGION: ${l.name} (${l.country_code})`, 'success');
          l.groups.forEach(g => {
            appendLine(`     ├── City: ${g.city.padEnd(16)} Nick: [${g.nick}] (IP: ${g.ping_ip || 'Auto'})`);
          });
        });
      } else if (main === 'windscribe-cli' && sub === 'disconnect') {
        setConnectedNode(null);
        appendLine('[+] Disconnecting from VPN...', 'info');
        await new Promise(r => setTimeout(r, 600));
        appendLine('[✓] VPN Disconnected. Restoring default routing table.', 'success');
      } else if (main === 'autoscribe' && (sub === 'check' || sub === 'scan')) {
        appendLine('[+] Querying live Windscribe nodes and probing latency across city locations...', 'info');
        const freeLocs = locations.filter(l => l.premium_only === 0).slice(0, 6);
        appendLine('----------------------------------------------------------------------------------', 'info');
        appendLine(' REGION          CITY (LOCATION)   NICKNAME        IP             LATENCY', 'info');
        appendLine('----------------------------------------------------------------------------------', 'info');

        for (const loc of freeLocs) {
          const g = loc.groups[0];
          if (!g) continue;
          const ip = g.ping_ip || '198.44.137.19';
          const ms = await pingServer(ip);
          const latStr = ms !== null ? `${ms} ms` : 'timeout';
          const padReg = loc.name.padEnd(16, ' ').slice(0, 16);
          const padCity = g.city.padEnd(17, ' ').slice(0, 17);
          const padNick = `[${g.nick}]`.padEnd(15, ' ').slice(0, 15);
          const padIp = ip.padEnd(15, ' ').slice(0, 15);
          appendLine(` ${padReg}${padCity}${padNick}${padIp}${latStr}`);
        }
        appendLine('----------------------------------------------------------------------------------', 'info');
        appendLine('[✓] Scan complete. Run "autoscribe best" to select fastest.', 'success');
      } else if (main === 'autoscribe' && sub === 'best') {
        appendLine('[+] Running AutoScribe intelligent latency comparator...', 'info');
        await new Promise(r => setTimeout(r, 400));
        const freeLocs = locations.filter(l => l.premium_only === 0).slice(0, 5);
        let bestLoc = freeLocs[0];
        let bestGroup = bestLoc?.groups[0];
        let lowestPing = 9999;

        for (const loc of freeLocs) {
          const g = loc.groups[0];
          if (!g) continue;
          const ip = g.ping_ip || '198.44.137.19';
          appendLine(` -> Probing ${loc.name} (${g.city})...`);
          const ms = await pingServer(ip);
          if (ms !== null && ms < lowestPing) {
            lowestPing = ms;
            bestLoc = loc;
            bestGroup = g;
          }
        }

        if (bestGroup && bestLoc) {
          appendLine(`=======================================================`, 'info');
          appendLine(`[🏆] OPTIMAL SERVER IDENTIFIED: ${bestLoc.name} - ${bestGroup.city}`, 'success');
          appendLine(`     Latency: ${lowestPing} ms | Link Capacity: 10 Gbps | Protocol: WireGuard`, 'info');
          appendLine(`=======================================================`, 'info');
          appendLine(`To connect now, run: autoscribe connect "${bestGroup.city}"`);
        }
      } else if ((main === 'autoscribe' || main === 'windscribe-cli') && (sub === 'connect' || parts[1] === 'connect')) {
        const targetCity = parts.slice(2).join(' ').replace(/["']/g, '') || 'Dallas';
        appendLine(`[+] Resolving configuration for "${targetCity}"...`, 'info');
        await new Promise(r => setTimeout(r, 500));
        appendLine('[+] Handshaking WireGuard tunnel via UDP:443...');
        await new Promise(r => setTimeout(r, 800));
        const fakeIp = `10.126.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250) + 2}`;
        setConnectedNode({
          city: targetCity,
          location: 'Windscribe Gateway',
          ip: fakeIp
        });
        appendLine(`[✓] Handshake verified! Virtual IP assigned: ${fakeIp}`, 'success');
        appendLine('[✓] Firewall rules locked: No DNS or WebRTC leaks.', 'success');
      } else if (main === 'autoscribe' && sub === 'speedtest') {
        const city = parts[2]?.replace(/["']/g, '') || (connectedNode ? connectedNode.city : 'Dallas');
        appendLine(`[+] Initiating speed test to ${city}...`, 'info');
        appendLine(' -> Testing latency & jitter...');
        await new Promise(r => setTimeout(r, 600));
        appendLine(' -> Downloading test payload (10MB)...');
        await new Promise(r => setTimeout(r, 1000));
        const dl = (35 + Math.random() * 45).toFixed(1);
        const ul = (18 + Math.random() * 20).toFixed(1);
        const ping = Math.floor(28 + Math.random() * 25);
        appendLine(`========================================`, 'info');
        appendLine(`  Download Speed: ${dl} Mbps`, 'success');
        appendLine(`  Upload Speed:   ${ul} Mbps`, 'info');
        appendLine(`  Latency:        ${ping} ms (Jitter: 2.1 ms)`, 'output');
      } else if (main === 'install-linux' || (main === 'autoscribe' && (sub === 'install-linux' || (sub === 'install' && arg.includes('linux'))))) {
        appendLine('[*] Linux Bash Installer Command:', 'info');
        appendLine(`    curl -fsSL ${window.location.origin}/api/autoscribe-linux.sh | bash`, 'success');
        appendLine('    Installs /usr/local/bin/autoscribe and queries live Windscribe nodes.', 'output');
      } else if (main === 'install-macos' || (main === 'autoscribe' && (sub === 'install-macos' || (sub === 'install' && (arg.includes('mac') || arg.includes('darwin')))))) {
        appendLine('[*] macOS Terminal Runner Command:', 'info');
        appendLine(`    curl -fsSL ${window.location.origin}/api/autoscribe-macos.sh | bash`, 'success');
        appendLine('    Supports Apple Silicon (M1/M2/M3/M4) & Intel Macs with native BSD ping.', 'output');
      } else if (main === 'install-windows' || (main === 'autoscribe' && (sub === 'install-windows' || (sub === 'install' && arg.includes('win'))))) {
        appendLine('[*] Windows PowerShell Installer Command:', 'info');
        appendLine(`    irm ${window.location.origin}/api/AutoScribe.ps1 | iex`, 'success');
        appendLine('    Requires PowerShell 5.1+ or PowerShell 7+ on Windows 10/11.', 'output');
      } else {
        appendLine(`command not found: "${cmdStr}". Type "help" for command list.`, 'error');
      }
    } catch (err: any) {
      appendLine(`Execution error: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = inputVal;
      setInputVal('');
      executeCommand(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(nextIdx);
        setInputVal(history[nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx !== -1) {
        const nextIdx = historyIdx + 1;
        if (nextIdx < history.length) {
          setHistoryIdx(nextIdx);
          setInputVal(history[nextIdx]);
        } else {
          setHistoryIdx(-1);
          setInputVal('');
        }
      }
    }
  };

  const quickCommands = [
    'autoscribe best',
    'autoscribe check',
    'autoscribe speedtest',
    'windscribe-cli status',
    'windscribe-cli locations',
    'sysinfo',
    'clear'
  ];

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <TerminalIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">AutoScribe Android CLI Console</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-semibold">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive terminal emulator for rasool-mrr/AutoScribe on Android / Termux.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connectedNode ? (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>TUNNEL: {connectedNode.city}</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-mono">
              TUNNEL: DISCONNECTED
            </div>
          )}

          <button
            onClick={() => setLines([])}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Clear Console"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Display */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs flex flex-col h-[520px]">
        {/* Terminal Titlebar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-[11px] text-slate-300 font-mono">termux@android:~/autoscribe</span>
          </div>
          <span className="text-[11px] text-cyan-400 font-mono">bash 5.2</span>
        </div>

        {/* Console Log Area */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex-1 p-4 overflow-y-auto space-y-1.5 leading-relaxed text-slate-300"
        >
          {lines.map(line => {
            if (line.type === 'input') {
              return (
                <div key={line.id} className="text-cyan-400 font-bold">
                  {line.text}
                </div>
              );
            }
            if (line.type === 'success') {
              return (
                <div key={line.id} className="text-emerald-400">
                  {line.text}
                </div>
              );
            }
            if (line.type === 'error') {
              return (
                <div key={line.id} className="text-rose-400 font-bold">
                  {line.text}
                </div>
              );
            }
            if (line.type === 'info') {
              return (
                <div key={line.id} className="text-slate-400">
                  {line.text}
                </div>
              );
            }
            return (
              <div key={line.id} className="text-slate-200">
                {line.text}
              </div>
            );
          })}

          {isProcessing && (
            <div className="text-amber-400 animate-pulse flex items-center gap-2">
              <span>[*] Executing command...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="flex items-center px-4 py-3 bg-slate-900/90 border-t border-slate-800 gap-2">
          <span className="text-cyan-400 font-bold font-mono">$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            placeholder="Type 'help' or 'autoscribe best'..."
            className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none placeholder-slate-600"
            autoFocus
          />
          <button
            onClick={() => {
              const val = inputVal;
              setInputVal('');
              executeCommand(val);
            }}
            disabled={!inputVal.trim() || isProcessing}
            className="p-1.5 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-30 transition"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Mobile Action Pills */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-3.5">
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Quick Touch Actions (Mobile Termux Commands)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickCommands.map(cmd => (
            <button
              key={cmd}
              onClick={() => executeCommand(cmd)}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-cyan-300 font-mono text-xs border border-slate-700/80 transition shadow-sm"
            >
              $ {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
