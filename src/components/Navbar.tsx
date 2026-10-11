import React from 'react';
import { ActiveTab } from '../types/vpn';
import { PWAInstallButton } from './PWAInstallButton';
import { Globe, Zap, Terminal, Smartphone, Shield, Wifi } from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  publicIp?: string | null;
  totalNodes: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  publicIp,
  totalNodes
}) => {
  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[#090d16]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo Brand */}
          <div
            onClick={() => onSelectTab('locations')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#090d16] animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white">AutoScribe</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                  ANDROID CLI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-none">Windscribe Speed & Node Engine</p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => onSelectTab('locations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'locations'
                  ? 'bg-cyan-500 text-black shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Locations</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded ${activeTab === 'locations' ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-400'}`}>
                {totalNodes}
              </span>
            </button>

            <button
              onClick={() => onSelectTab('benchmark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'benchmark'
                  ? 'bg-cyan-500 text-black shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Speed Benchmark</span>
            </button>

            <button
              onClick={() => onSelectTab('cli')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'cli'
                  ? 'bg-cyan-500 text-black shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Android CLI</span>
            </button>

            <button
              onClick={() => onSelectTab('termux')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'termux'
                  ? 'bg-cyan-500 text-black shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Installers & Guides</span>
            </button>
          </nav>

          {/* Right Action Area */}
          <div className="flex items-center gap-2.5">
            {publicIp && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                <Wifi className="w-3 h-3 text-cyan-400" />
                <span>IP: {publicIp}</span>
              </div>
            )}

            {/* In-app Install Prompt UI (Mandatory by PWA skill) */}
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Android Native Feel) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/95 backdrop-blur-lg border-t border-slate-800 px-3 py-2">
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => onSelectTab('locations')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'locations'
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 mb-0.5" />
            <span>Locations</span>
          </button>

          <button
            onClick={() => onSelectTab('benchmark')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'benchmark'
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 mb-0.5" />
            <span>Speed</span>
          </button>

          <button
            onClick={() => onSelectTab('cli')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'cli'
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4 mb-0.5" />
            <span>CLI</span>
          </button>

          <button
            onClick={() => onSelectTab('termux')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'termux'
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 mb-0.5" />
            <span>Install</span>
          </button>
        </div>
      </div>
    </>
  );
};
