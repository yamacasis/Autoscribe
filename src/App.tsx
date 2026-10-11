/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WindscribeLocation, WindscribeGroup, NodePingResult, ActiveTab } from './types/vpn';
import { FALLBACK_LOCATIONS } from './data/fallbackServers';
import { Navbar } from './components/Navbar';
import { LocationsExplorer } from './components/LocationsExplorer';
import { SpeedBenchmark } from './components/SpeedBenchmark';
import { TerminalCLI } from './components/TerminalCLI';
import { AndroidTermuxGuide } from './components/AndroidTermuxGuide';
import { ConfigModal } from './components/ConfigModal';
import { Github, Shield, Radio, WifiOff, ExternalLink, Activity } from 'lucide-react';

export default function App() {
  const [locations, setLocations] = useState<WindscribeLocation[]>(FALLBACK_LOCATIONS);
  const [activeTab, setActiveTab] = useState<ActiveTab>('locations');
  const [pingResults, setPingResults] = useState<Map<number, NodePingResult>>(new Map());
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Modal & Tab routing
  const [activeConfig, setActiveConfig] = useState<{
    location: WindscribeLocation;
    group: WindscribeGroup;
  } | null>(null);

  const [benchmarkTarget, setBenchmarkTarget] = useState<{
    location: WindscribeLocation;
    group: WindscribeGroup;
  } | null>(null);

  const [externalCommand, setExternalCommand] = useState<string | null>(null);

  // Fetch live locations & IP on mount
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Fetch live locations
    fetch('/api/windscribe/locations')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
          setLocations(data.data);
        }
      })
      .catch(err => {
        console.warn('Using fallback locations cache:', err);
      });

    // Fetch IP
    fetch('/api/my-ip')
      .then(res => res.json())
      .then(data => {
        if (data && data.ip) {
          setPublicIp(data.ip);
        }
      })
      .catch(() => {
        // Fallback IP probe
        fetch('https://api.ipify.org?format=json')
          .then(r => r.json())
          .then(d => setPublicIp(d.ip))
          .catch(() => {});
      });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleUpdatePing = (nodeId: number, result: Partial<NodePingResult>) => {
    setPingResults(prev => {
      const next = new Map(prev);
      const existing = next.get(nodeId) || {
        nodeId,
        city: '',
        nick: '',
        countryCode: '',
        ip: '',
        pingMs: null,
        status: 'idle'
      };
      next.set(nodeId, { ...existing, ...result });
      return next;
    });
  };

  const handleStartSpeedTest = (group: WindscribeGroup, location: WindscribeLocation) => {
    setBenchmarkTarget({ group, location });
    setActiveTab('benchmark');
  };

  const handleRunCliCommand = (cmd: string) => {
    setExternalCommand(cmd);
    setActiveTab('cli');
  };

  const totalNodesCount = locations.reduce((sum, l) => sum + l.groups.length, 0);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black pb-20 md:pb-8">
      {/* Offline Alert Bar if network disconnects */}
      {!isOnline && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>Offline mode: Using cached Windscribe server database and local configuration engine.</span>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        publicIp={publicIp}
        totalNodes={totalNodesCount}
      />

      {/* Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeTab === 'locations' && (
          <LocationsExplorer
            locations={locations}
            pingResults={pingResults}
            onUpdatePing={handleUpdatePing}
            onOpenConfig={(loc, grp) => setActiveConfig({ location: loc, group: grp })}
            onStartSpeedTest={handleStartSpeedTest}
            onRunCliCommand={handleRunCliCommand}
          />
        )}

        {activeTab === 'benchmark' && (
          <SpeedBenchmark
            locations={locations}
            initialTarget={benchmarkTarget}
            onOpenConfig={(loc, grp) => setActiveConfig({ location: loc, group: grp })}
            onRunCliCommand={handleRunCliCommand}
          />
        )}

        {activeTab === 'cli' && (
          <TerminalCLI
            locations={locations}
            externalCommand={externalCommand}
            onClearExternalCommand={() => setExternalCommand(null)}
          />
        )}

        {activeTab === 'termux' && (
          <AndroidTermuxGuide />
        )}
      </main>

      {/* Config Export / QR Code Modal */}
      {activeConfig && (
        <ConfigModal
          location={activeConfig.location}
          group={activeConfig.group}
          onClose={() => setActiveConfig(null)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-12 py-6 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>AutoScribe for Windscribe • Android Companion</span>
            <span>•</span>
            <span className="font-mono">{locations.length} Countries</span>
            <span>•</span>
            <span className="font-mono">{totalNodesCount} Nodes</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <a
              href="https://github.com/rasool-mrr/AutoScribe"
              target="_blank"
              rel="noreferrer"
              className="hover:text-cyan-400 transition flex items-center gap-1 font-mono text-[11px]"
            >
              <Github className="w-3.5 h-3.5" />
              <span>rasool-mrr/AutoScribe</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
            <span>•</span>
            <span className="text-[11px]">WireGuard & OpenVPN Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
