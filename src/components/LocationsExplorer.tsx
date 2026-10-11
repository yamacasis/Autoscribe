import React, { useState, useMemo } from 'react';
import { WindscribeLocation, WindscribeGroup, NodePingResult } from '../types/vpn';
import { pingServer } from '../utils/speedTester';
import {
  Search,
  Zap,
  Globe,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Download,
  Terminal,
  Activity,
  Check,
  Sparkles,
  Server
} from 'lucide-react';

interface LocationsExplorerProps {
  locations: WindscribeLocation[];
  pingResults: Map<number, NodePingResult>;
  onUpdatePing: (nodeId: number, result: Partial<NodePingResult>) => void;
  onOpenConfig: (location: WindscribeLocation, group: WindscribeGroup) => void;
  onStartSpeedTest: (group: WindscribeGroup, location: WindscribeLocation) => void;
  onRunCliCommand: (cmd: string) => void;
}

export const LocationsExplorer: React.FC<LocationsExplorerProps> = ({
  locations,
  pingResults,
  onUpdatePing,
  onOpenConfig,
  onStartSpeedTest,
  onRunCliCommand
}) => {
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState<'all' | 'free' | 'pro'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'ping' | 'nodes'>('name');
  const [expandedLocs, setExpandedLocs] = useState<Set<number>>(new Set([65, 66])); // default expand US
  const [batchPinging, setBatchPinging] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Region categorizer based on country code
  const getContinent = (cc: string) => {
    const na = ['US', 'CA', 'MX'];
    const eu = ['GB', 'DE', 'FR', 'NL', 'CH', 'NO', 'RO', 'IT', 'ES', 'SE', 'DK', 'PL', 'CZ', 'AT', 'BE', 'IE', 'PT', 'FI'];
    const ap = ['HK', 'JP', 'SG', 'AU', 'NZ', 'KR', 'TW', 'IN', 'MY', 'TH', 'VN', 'PH', 'ID'];
    if (na.includes(cc)) return 'North America';
    if (eu.includes(cc)) return 'Europe';
    if (ap.includes(cc)) return 'Asia Pacific';
    return 'Other Regions';
  };

  const toggleExpand = (id: number) => {
    setExpandedLocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedLocs(new Set(locations.map(l => l.id)));
  };

  const collapseAll = () => {
    setExpandedLocs(new Set());
  };

  // Filtered and sorted locations
  const filteredLocations = useMemo(() => {
    return locations
      .filter(loc => {
        // Search filter
        if (search) {
          const q = search.toLowerCase();
          const matchLoc =
            loc.name.toLowerCase().includes(q) ||
            loc.country_code.toLowerCase().includes(q) ||
            loc.short_name.toLowerCase().includes(q);
          const matchGroup = loc.groups.some(
            g =>
              g.city.toLowerCase().includes(q) ||
              g.nick.toLowerCase().includes(q) ||
              (g.ping_ip && g.ping_ip.includes(q))
          );
          if (!matchLoc && !matchGroup) return false;
        }

        // Tier filter
        if (filterTier === 'free' && loc.premium_only !== 0) return false;
        if (filterTier === 'pro' && loc.premium_only === 0) return false;

        // Region filter
        if (regionFilter !== 'all') {
          if (getContinent(loc.country_code) !== regionFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'nodes') {
          return b.groups.length - a.groups.length;
        }
        if (sortBy === 'ping') {
          // Find lowest ping among groups
          const getMinPing = (loc: WindscribeLocation) => {
            let min = 999999;
            for (const g of loc.groups) {
              const res = pingResults.get(g.id);
              if (res && res.pingMs !== null) {
                min = Math.min(min, res.pingMs);
              }
            }
            return min;
          };
          return getMinPing(a) - getMinPing(b);
        }
        return 0;
      });
  }, [locations, search, filterTier, regionFilter, sortBy, pingResults]);

  // Total counts
  const totalNodesCount = useMemo(() => {
    return locations.reduce((sum, l) => sum + l.groups.length, 0);
  }, [locations]);

  const freeNodesCount = useMemo(() => {
    return locations.filter(l => l.premium_only === 0).reduce((sum, l) => sum + l.groups.length, 0);
  }, [locations]);

  // Batch Ping visible or free servers
  const handleBatchPing = async () => {
    if (batchPinging) return;
    setBatchPinging(true);

    const nodesToPing: { group: WindscribeGroup; location: WindscribeLocation }[] = [];
    filteredLocations.slice(0, 30).forEach(loc => {
      loc.groups.forEach(g => {
        nodesToPing.push({ group: g, location: loc });
      });
    });

    const concurrency = 4;
    for (let i = 0; i < nodesToPing.length; i += concurrency) {
      const slice = nodesToPing.slice(i, i + concurrency);
      await Promise.all(
        slice.map(async ({ group, location }) => {
          const ip = group.ping_ip || group.wg_endpoint || location.dns_hostname || '198.44.137.19';
          onUpdatePing(group.id, {
            nodeId: group.id,
            city: group.city,
            nick: group.nick,
            countryCode: location.country_code,
            ip,
            status: 'testing'
          });

          const latency = await pingServer(ip);
          onUpdatePing(group.id, {
            pingMs: latency,
            status: latency !== null ? 'success' : 'failed',
            testedAt: Date.now()
          });
        })
      );
    }

    setBatchPinging(false);
  };

  const handleSinglePing = async (group: WindscribeGroup, location: WindscribeLocation) => {
    const ip = group.ping_ip || group.wg_endpoint || location.dns_hostname || '198.44.137.19';
    onUpdatePing(group.id, {
      nodeId: group.id,
      city: group.city,
      nick: group.nick,
      countryCode: location.country_code,
      ip,
      status: 'testing'
    });

    const latency = await pingServer(ip);
    onUpdatePing(group.id, {
      pingMs: latency,
      status: latency !== null ? 'success' : 'failed',
      testedAt: Date.now()
    });
  };

  const handleCopyCli = (loc: WindscribeLocation, group: WindscribeGroup) => {
    const cmd = `windscribe-cli connect "${loc.name}" "${group.city}"`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(`${loc.id}-${group.id}`);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
                <Globe className="w-3.5 h-3.5" />
                Global Server Fleet
              </span>
              <span className="text-xs text-slate-400">
                {locations.length} Countries • {totalNodesCount} Server Nodes
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Windscribe VPN Locations & Latency Prober
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl">
              Inspect active endpoints, run live TCP ping measurements, generate instant WireGuard / OpenVPN profiles, or copy native CLI connect commands.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleBatchPing}
              disabled={batchPinging}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs transition shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 ${batchPinging ? 'animate-spin' : ''}`} />
              <span>{batchPinging ? 'Pinging Nodes...' : 'Ping Visible Servers'}</span>
            </button>
            <button
              onClick={() => {
                onRunCliCommand('autoscribe check');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition active:scale-95"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>CLI Scan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-4 space-y-4 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by country, city (Dallas, London, Tokyo), nick or IP..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition font-mono"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Expand / Collapse */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium mr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Tier:
            </span>
            <button
              onClick={() => setFilterTier('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filterTier === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Tiers ({locations.length})
            </button>
            <button
              onClick={() => setFilterTier('free')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filterTier === 'free'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              Free Tier Nodes ({freeNodesCount})
            </button>
            <button
              onClick={() => setFilterTier('pro')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filterTier === 'pro'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              Pro Servers Only
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">Region:</span>
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Continents</option>
              <option value="North America">North America</option>
              <option value="Europe">Europe</option>
              <option value="Asia Pacific">Asia Pacific</option>
              <option value="Other Regions">Other Regions</option>
            </select>

            <span className="text-[11px] text-slate-500 font-medium ml-2">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="name">Country Name</option>
              <option value="ping">Lowest Ping Latency</option>
              <option value="nodes">Server Node Count</option>
            </select>
          </div>
        </div>
      </div>

      {/* Locations Cards List */}
      <div className="space-y-4">
        {filteredLocations.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800">
            <Server className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No matching locations found</h3>
            <p className="text-xs text-slate-400">Try adjusting your search query or tier filters.</p>
          </div>
        ) : (
          filteredLocations.map(loc => {
            const isExpanded = expandedLocs.has(loc.id);
            const isFree = loc.premium_only === 0;

            // Check if any node in this location has ping result
            const nodePings = loc.groups
              .map(g => pingResults.get(g.id)?.pingMs)
              .filter((p): p is number => typeof p === 'number');
            const minPing = nodePings.length > 0 ? Math.min(...nodePings) : null;

            return (
              <div
                key={loc.id}
                className={`rounded-2xl border transition-all ${
                  isFree
                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Location Header Row */}
                <div
                  onClick={() => toggleExpand(loc.id)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Flag / Country badge */}
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs tracking-wider text-cyan-400 font-mono shadow-inner">
                      {loc.country_code}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm md:text-base font-bold text-white">{loc.name}</h3>
                        <span className="text-[11px] text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded">
                          {loc.short_name}
                        </span>
                        {isFree ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase tracking-wide">
                            Free Tier
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-wide">
                            Pro
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {loc.groups.length} node{loc.groups.length > 1 ? 's' : ''} • {loc.dns_hostname || 'windscribe.com'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Lowest ping badge if available */}
                    {minPing !== null && (
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                          minPing < 80
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : minPing < 160
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        ⚡ {minPing} ms
                      </span>
                    )}

                    <div className="p-1 rounded-lg text-slate-400 hover:text-white">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Cities / Nodes Table */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 px-4 py-3 bg-slate-950/40 divide-y divide-slate-800/50">
                    {loc.groups.map(group => {
                      const pingInfo = pingResults.get(group.id);
                      const isNodePro = group.pro === 1;

                      return (
                        <div
                          key={group.id}
                          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{group.city}</span>
                                <span className="text-[11px] text-cyan-400 font-mono bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.2 rounded">
                                  "{group.nick}"
                                </span>
                                {isNodePro ? (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-semibold">
                                    PRO
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 font-semibold">
                                    FREE
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                                <span>IP: {group.ping_ip || 'Auto'}</span>
                                <span>•</span>
                                <span>Speed: {parseInt(group.link_speed || '10000', 10) / 1000} Gbps</span>
                                {group.wg_endpoint && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-500 truncate max-w-[180px]">{group.wg_endpoint}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Node Action Buttons */}
                          <div className="flex items-center gap-2">
                            {/* Ping Badge / Button */}
                            <button
                              onClick={() => handleSinglePing(group, loc)}
                              disabled={pingInfo?.status === 'testing'}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold transition inline-flex items-center gap-1.5 ${
                                pingInfo?.status === 'testing'
                                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 animate-pulse'
                                  : pingInfo?.pingMs !== null && pingInfo?.pingMs !== undefined
                                  ? pingInfo.pingMs < 80
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                    : pingInfo.pingMs < 160
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                              }`}
                              title="Measure ping latency"
                            >
                              <Radio className="w-3.5 h-3.5" />
                              <span>
                                {pingInfo?.status === 'testing'
                                  ? 'Testing...'
                                  : pingInfo?.pingMs !== null && pingInfo?.pingMs !== undefined
                                  ? `${pingInfo.pingMs} ms`
                                  : 'Ping'}
                              </span>
                            </button>

                            {/* Speed Test */}
                            <button
                              onClick={() => onStartSpeedTest(group, loc)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600/20 hover:text-cyan-300 border border-slate-700 text-slate-300 text-xs font-semibold transition inline-flex items-center gap-1"
                              title="Run full download/upload speedtest"
                            >
                              <Zap className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="hidden sm:inline">Speed</span>
                            </button>

                            {/* Config Modal */}
                            <button
                              onClick={() => onOpenConfig(loc, group)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition inline-flex items-center gap-1"
                              title="Export WireGuard or OpenVPN Profile"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-400" />
                              <span>Config</span>
                            </button>

                            {/* Copy CLI */}
                            <button
                              onClick={() => handleCopyCli(loc, group)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition inline-flex items-center gap-1"
                              title="Copy windscribe-cli connect command"
                            >
                              {copiedCmd === `${loc.id}-${group.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span className="hidden sm:inline">CLI</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
