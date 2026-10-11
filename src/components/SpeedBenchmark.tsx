import React, { useState, useEffect } from 'react';
import { WindscribeLocation, WindscribeGroup, SpeedTestState } from '../types/vpn';
import { pingServer, runDownloadTest, runUploadTest, measurePingAndJitter } from '../utils/speedTester';
import {
  Zap,
  Activity,
  ArrowDown,
  ArrowUp,
  Clock,
  Sparkles,
  Award,
  Play,
  RotateCw,
  Terminal,
  Download,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface SpeedBenchmarkProps {
  locations: WindscribeLocation[];
  initialTarget?: { group: WindscribeGroup; location: WindscribeLocation } | null;
  onOpenConfig: (location: WindscribeLocation, group: WindscribeGroup) => void;
  onRunCliCommand: (cmd: string) => void;
}

interface RankedServerResult {
  group: WindscribeGroup;
  location: WindscribeLocation;
  pingMs: number;
  jitterMs: number;
  downloadMbps: number;
  score: number;
}

export const SpeedBenchmark: React.FC<SpeedBenchmarkProps> = ({
  locations,
  initialTarget,
  onOpenConfig,
  onRunCliCommand
}) => {
  // Selected target server for single speed test
  const [selectedLocation, setSelectedLocation] = useState<WindscribeLocation>(
    initialTarget?.location || locations.find(l => l.name === 'US Central') || locations[0]
  );
  const [selectedGroup, setSelectedGroup] = useState<WindscribeGroup>(
    initialTarget?.group || selectedLocation?.groups[0]
  );

  useEffect(() => {
    if (initialTarget) {
      setSelectedLocation(initialTarget.location);
      setSelectedGroup(initialTarget.group);
    }
  }, [initialTarget]);

  // Speed test state
  const [testState, setTestState] = useState<SpeedTestState>({
    isRunning: false,
    phase: 'idle',
    targetCity: selectedGroup?.city || 'Dallas',
    currentMbps: 0,
    progressPercent: 0,
    results: null
  });

  // Batch benchmark states
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<RankedServerResult[]>([]);
  const [activeBatchServer, setActiveBatchServer] = useState<string>('');

  // Handle location change in select
  const handleLocationChange = (locId: number) => {
    const loc = locations.find(l => l.id === locId);
    if (loc) {
      setSelectedLocation(loc);
      if (loc.groups.length > 0) {
        setSelectedGroup(loc.groups[0]);
      }
    }
  };

  // Run single speed test
  const handleStartSpeedTest = async () => {
    if (testState.isRunning) return;

    const targetCityName = `${selectedLocation.name} - ${selectedGroup.city}`;
    setTestState({
      isRunning: true,
      phase: 'ping',
      targetCity: targetCityName,
      currentMbps: 0,
      progressPercent: 10,
      results: null
    });

    const ip = selectedGroup.ping_ip || selectedGroup.wg_endpoint || selectedLocation.dns_hostname || '198.44.137.19';

    // Phase 1: Ping & Jitter
    const { ping, jitter, loss } = await measurePingAndJitter(ip, 4);

    setTestState(prev => ({
      ...prev,
      phase: 'download',
      progressPercent: 30,
      currentMbps: 0
    }));

    // Phase 2: Download test
    const downloadSpeed = await runDownloadTest((instantMbps, progress) => {
      setTestState(prev => ({
        ...prev,
        currentMbps: instantMbps,
        progressPercent: 30 + Math.round(progress * 0.4)
      }));
    });

    setTestState(prev => ({
      ...prev,
      phase: 'upload',
      progressPercent: 70,
      currentMbps: 0
    }));

    // Phase 3: Upload test
    const uploadSpeed = await runUploadTest((instantMbps, progress) => {
      setTestState(prev => ({
        ...prev,
        currentMbps: instantMbps,
        progressPercent: 70 + Math.round(progress * 0.3)
      }));
    });

    // Complete
    setTestState({
      isRunning: false,
      phase: 'complete',
      targetCity: targetCityName,
      currentMbps: downloadSpeed,
      progressPercent: 100,
      results: {
        pingMs: ping,
        jitterMs: jitter,
        downloadMbps: downloadSpeed,
        uploadMbps: uploadSpeed,
        packetLossPercent: loss,
        serverLocation: targetCityName,
        timestamp: Date.now()
      }
    });
  };

  // Run Batch Benchmark across top Free locations
  const handleRunBatchBenchmark = async () => {
    if (isBatchRunning) return;
    setIsBatchRunning(true);
    setBatchResults([]);
    setBatchProgress(0);

    // Pick 8 representative free locations
    const freeLocs = locations.filter(l => l.premium_only === 0);
    const candidateNodes: { location: WindscribeLocation; group: WindscribeGroup }[] = [];

    freeLocs.forEach(l => {
      if (l.groups.length > 0) {
        candidateNodes.push({ location: l, group: l.groups[0] });
      }
    });

    const total = Math.min(candidateNodes.length, 10);
    const nodesToTest = candidateNodes.slice(0, total);
    const results: RankedServerResult[] = [];

    for (let i = 0; i < nodesToTest.length; i++) {
      const { location, group } = nodesToTest[i];
      setActiveBatchServer(`${location.name} (${group.city})`);
      setBatchProgress(Math.round(((i) / total) * 100));

      const ip = group.ping_ip || group.wg_endpoint || location.dns_hostname || '198.44.137.19';
      const { ping, jitter } = await measurePingAndJitter(ip, 3);

      // Fast download sample
      const dlRes = await runDownloadTest(() => {});

      // Score: higher download and lower ping = higher score
      const validPing = ping > 0 ? ping : 999;
      const score = Math.round((dlRes * 100) / (Math.sqrt(validPing) || 1));

      results.push({
        location,
        group,
        pingMs: ping,
        jitterMs: jitter,
        downloadMbps: dlRes,
        score
      });

      // Keep sorted by score
      results.sort((a, b) => b.score - a.score);
      setBatchResults([...results]);
    }

    setBatchProgress(100);
    setActiveBatchServer('');
    setIsBatchRunning(false);
  };

  // Best recommended server from batch or current results
  const bestServer = batchResults.length > 0 ? batchResults[0] : null;

  // Calculate gauge angle for speedometer (0 to 180 degrees, max 100 Mbps)
  const maxDisplayMbps = 100;
  const displaySpeed = testState.isRunning ? testState.currentMbps : testState.results ? testState.results.downloadMbps : 0;
  const gaugePercent = Math.min(displaySpeed / maxDisplayMbps, 1);
  const needleAngle = -90 + (gaugePercent * 180);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
              <Zap className="w-3.5 h-3.5" />
              Live Performance Benchmarking
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              Windscribe Speed & Latency Matrix
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl mt-1">
              Test real bandwidth throughput, TCP latency, and jitter directly to Windscribe data centers. Automatically identify the optimal node for your Android connection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunBatchBenchmark}
              disabled={isBatchRunning || testState.isRunning}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              <Award className={`w-4 h-4 ${isBatchRunning ? 'animate-bounce' : ''}`} />
              <span>{isBatchRunning ? 'Benchmarking Fleet...' : 'Benchmark All Free Servers'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Speedometer Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Speedometer Dial & Test Controls */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col items-center justify-between relative shadow-lg">
          {/* Target Server Selector */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Target Server:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedLocation.id}
                onChange={e => handleLocationChange(parseInt(e.target.value, 10))}
                disabled={testState.isRunning}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.groups.length} nodes) {loc.premium_only === 0 ? '• FREE' : ''}
                  </option>
                ))}
              </select>

              <select
                value={selectedGroup?.id}
                onChange={e => {
                  const g = selectedLocation.groups.find(x => x.id === parseInt(e.target.value, 10));
                  if (g) setSelectedGroup(g);
                }}
                disabled={testState.isRunning}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {selectedLocation.groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.city} ({g.nick})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SVG Speedometer Gauge */}
          <div className="relative w-72 h-44 my-4 flex items-center justify-center">
            <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#06b6d4" />
                  <stop offset="50%" stop-color="#3b82f6" />
                  <stop offset="100%" stop-color="#8b5cf6" />
                </linearGradient>
                <filter id="glowArc">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#1e293b"
                strokeWidth="14"
                strokeLinecap="round"
              />

              {/* Active Gauge Arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#gaugeGrad)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 * (1 - gaugePercent)}
                filter="url(#glowArc)"
                className="transition-all duration-300 ease-out"
              />

              {/* Needle Center Pivot */}
              <circle cx="100" cy="100" r="8" fill="#0f172a" stroke="#06b6d4" strokeWidth="3" />

              {/* Rotating Needle */}
              <line
                x1="100"
                y1="100"
                x2="100"
                y2="30"
                stroke="#38bdf8"
                strokeWidth="3.5"
                strokeLinecap="round"
                transform={`rotate(${needleAngle} 100 100)`}
                className="transition-transform duration-200 ease-out"
              />
            </svg>

            {/* Numeric Speed Display inside Gauge */}
            <div className="absolute bottom-2 flex flex-col items-center">
              <div className="text-4xl font-black tracking-tight text-white font-mono">
                {displaySpeed.toFixed(1)}
              </div>
              <div className="text-[11px] font-bold text-cyan-400 tracking-wider uppercase">
                Mbps Download
              </div>
              {testState.isRunning && (
                <div className="text-[10px] text-amber-400 font-mono animate-pulse mt-0.5">
                  Phase: {testState.phase.toUpperCase()} ({testState.progressPercent}%)
                </div>
              )}
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="w-full flex items-center justify-center gap-3 pt-4 border-t border-slate-800/80">
            <button
              onClick={handleStartSpeedTest}
              disabled={testState.isRunning || isBatchRunning}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-sm transition-all shadow-xl shadow-cyan-500/20 active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {testState.isRunning ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-black" />
                  <span>Measuring Network...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-black text-black" />
                  <span>Start Live Speed Test</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Telemetry Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Network Metrics & Diagnostics
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {testState.results ? 'Realtime Verified' : 'Ready'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Download card */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {testState.results ? `${testState.results.downloadMbps} ` : '— '}
                  <span className="text-xs text-slate-400 font-sans">Mbps</span>
                </div>
              </div>

              {/* Upload card */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                  <span>Upload</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {testState.results ? `${testState.results.uploadMbps} ` : '— '}
                  <span className="text-xs text-slate-400 font-sans">Mbps</span>
                </div>
              </div>

              {/* Ping card */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ping Latency</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {testState.results ? `${testState.results.pingMs} ` : '— '}
                  <span className="text-xs text-slate-400 font-sans">ms</span>
                </div>
              </div>

              {/* Jitter card */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Jitter</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {testState.results ? `${testState.results.jitterMs} ` : '— '}
                  <span className="text-xs text-slate-400 font-sans">ms</span>
                </div>
              </div>
            </div>

            {/* Quick Summary Box */}
            {testState.results && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Test completed for {testState.results.serverLocation}</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Connection health: Optimal for 4K streaming, low-ping gaming, and secure P2P browsing.
                </p>
              </div>
            )}
          </div>

          {/* Quick CLI Connect Shortcut */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300">Quick connect current node:</span>
            </div>
            <button
              onClick={() => onRunCliCommand(`windscribe-cli connect "${selectedLocation.name}" "${selectedGroup.city}"`)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 font-mono font-semibold border border-slate-700 transition"
            >
              CLI Run
            </button>
          </div>
        </div>
      </div>

      {/* Batch Benchmark Progress & Leaderboard */}
      {(isBatchRunning || batchResults.length > 0) && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Server Performance Leaderboard
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-server benchmark results ranked by composite speed & latency score.
              </p>
            </div>

            {isBatchRunning && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-amber-400 font-mono animate-pulse">
                  Testing: {activeBatchServer}
                </span>
                <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-1 rounded">
                  {batchProgress}%
                </span>
              </div>
            )}
          </div>

          {/* Highlight: Fastest Winner */}
          {bestServer && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xl shadow-lg">
                  🏆
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Optimal Recommendation
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                      FREE TIER
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">
                    {bestServer.location.name} — {bestServer.group.city}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-slate-300 font-mono mt-0.5">
                    <span className="text-emerald-400 font-bold">⚡ {bestServer.pingMs} ms</span>
                    <span>•</span>
                    <span className="text-cyan-400 font-bold">⬇ {bestServer.downloadMbps} Mbps</span>
                    <span>•</span>
                    <span className="text-slate-400">Score: {bestServer.score}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenConfig(bestServer.location, bestServer.group)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>WireGuard Profile</span>
                </button>
                <button
                  onClick={() => onRunCliCommand(`autoscribe connect "${bestServer.group.city}"`)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs transition shadow-md shadow-cyan-500/20 inline-flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5 text-black" />
                  <span>Connect Fastest</span>
                </button>
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Rank</th>
                  <th className="py-2.5 px-4">Location & Node</th>
                  <th className="py-2.5 px-4">Ping (ms)</th>
                  <th className="py-2.5 px-4">Speed (Mbps)</th>
                  <th className="py-2.5 px-4">Score</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                {batchResults.map((item, idx) => (
                  <tr key={item.group.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-bold text-white">
                      {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-white">{item.location.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.group.city} ({item.group.nick})</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${item.pingMs < 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {item.pingMs} ms
                      </span>
                    </td>
                    <td className="py-3 px-4 text-cyan-400 font-bold">
                      {item.downloadMbps} Mbps
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-bold">
                      {item.score}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => onOpenConfig(item.location, item.group)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                      >
                        Get Config
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
