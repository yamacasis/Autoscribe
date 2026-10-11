import React, { useState } from 'react';
import {
  Smartphone,
  Terminal,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Monitor,
  Flame,
  CheckCircle2,
  ExternalLink,
  Code2,
  Command,
  ShieldCheck,
  Zap,
  HardDrive,
  Laptop
} from 'lucide-react';

export const AndroidTermuxGuide: React.FC = () => {
  const [activeOs, setActiveOs] = useState<'linux' | 'macos' | 'windows' | 'android'>('linux');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  // --- LINUX COMMANDS ---
  const linuxOneClick = `curl -fsSL ${origin}/api/autoscribe-linux.sh | bash`;

  const linuxAptSetup = `# 1. Install prerequisites
sudo apt-get update && sudo apt-get install -y curl jq iputils-ping wireguard-tools openvpn resolvconf

# 2. Add Windscribe Official Repository & Install CLI
curl -fsSL https://repo.windscribe.com/ubuntu/windscribe.gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/windscribe.gpg --yes
echo "deb https://repo.windscribe.com/ubuntu focal main" | sudo tee /etc/apt/sources.list.d/windscribe-repo.list
sudo apt-get update
sudo apt-get install -y windscribe-cli

# 3. Authenticate & Run AutoScribe
windscribe-cli login
autoscribe`;

  const linuxArchSetup = `# Arch Linux / Manjaro
yay -S windscribe-cli wireguard-tools jq curl
sudo systemctl enable --now windscribe-helper
windscribe-cli login
curl -fsSL ${origin}/api/autoscribe-linux.sh | bash`;

  const linuxFedoraSetup = `# Fedora / RHEL
sudo dnf install -y dnf-plugins-core curl jq iputils wireguard-tools
sudo dnf config-manager --add-repo https://repo.windscribe.com/rpm/windscribe.repo
sudo dnf install -y windscribe-cli
windscribe-cli login
curl -fsSL ${origin}/api/autoscribe-linux.sh | bash`;

  // --- MACOS COMMANDS ---
  const macosOneClick = `curl -fsSL ${origin}/api/autoscribe-macos.sh | bash`;

  const macosBrewSetup = `# 1. Install Windscribe for Mac via Homebrew
brew install --cask windscribe

# 2. Add windscribe-cli to PATH (Apple Silicon / Intel)
sudo ln -sf /Applications/Windscribe.app/Contents/MacOS/windscribe-cli /usr/local/bin/windscribe-cli

# 3. Run AutoScribe Speed & Location Benchmark
curl -fsSL ${origin}/api/autoscribe-macos.sh | bash`;

  // --- WINDOWS POWERSHELL COMMANDS ---
  const windowsOneClick = `irm ${origin}/api/AutoScribe.ps1 | iex`;

  const windowsWingetInstall = `# 1. Install Windscribe with Windows Package Manager (winget)
winget install Windscribe.Windscribe --accept-source-agreements --accept-package-agreements

# 2. Add Windscribe CLI to current PowerShell session
$env:Path += ";C:\\Program Files\\Windscribe\\"

# 3. Log in with your Windscribe credentials
windscribe-cli.exe login

# 4. Run AutoScribe Location & Latency Checker
irm ${origin}/api/AutoScribe.ps1 | iex`;

  const windowsProfileAlias = `# Add AutoScribe alias to your persistent PowerShell Profile
if (!(Test-Path $PROFILE)) { New-Item -Type File -Path $PROFILE -Force }
Add-Content $PROFILE '
function autoscribe {
    irm ${origin}/api/AutoScribe.ps1 | iex
}
Set-Alias -Name ws -Value "C:\\Program Files\\Windscribe\\windscribe-cli.exe"
'
Write-Host "AutoScribe added to PowerShell profile! You can now just type: autoscribe" -ForegroundColor Green`;

  // --- ANDROID TERMUX COMMANDS ---
  const androidOneClick = `pkg update -y && pkg install -y curl python git jq openvpn wireguard-tools
curl -sL ${origin}/api/autoscribe.sh -o autoscribe.sh
chmod +x autoscribe.sh
./autoscribe.sh`;

  const androidProotUbuntu = `pkg install -y proot-distro
proot-distro install ubuntu
proot-distro login ubuntu

# Inside Ubuntu proot:
apt update && apt install -y curl gpg apt-transport-https resolvconf
apt-key adv --keyserver keyserver.ubuntu.com --recv-key FDC247B7
echo "deb https://repo.windscribe.com/ubuntu focal main" | tee /etc/apt/sources.list.d/windscribe-repo.list
apt update
apt install -y windscribe-cli

# Login and test:
windscribe-cli login
windscribe-cli connect "US Central"`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <Command className="w-3.5 h-3.5" />
            Cross-Platform CLI Installation Suite
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white">
            AutoScribe Setup & Automation Scripts
          </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Choose your operating system below to access one-line installers, package manager configurations, and automated fastest-server connect scripts for <strong>Linux Bash</strong>, <strong>macOS</strong>, <strong>Windows PowerShell</strong>, and <strong>Android Termux</strong>.
          </p>
        </div>
      </div>

      {/* OS Selector Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 rounded-2xl p-1.5 gap-1.5">
        <button
          onClick={() => setActiveOs('linux')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition ${
            activeOs === 'linux'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-lg shadow-cyan-500/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Linux (Bash)</span>
        </button>

        <button
          onClick={() => setActiveOs('macos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition ${
            activeOs === 'macos'
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>macOS (Terminal)</span>
        </button>

        <button
          onClick={() => setActiveOs('windows')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition ${
            activeOs === 'windows'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>Windows (PowerShell)</span>
        </button>

        <button
          onClick={() => setActiveOs('android')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition ${
            activeOs === 'android'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-black shadow-lg shadow-emerald-500/20'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Android (Termux)</span>
        </button>
      </div>

      {/* OS CONTENT: LINUX BASH */}
      {activeOs === 'linux' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Linux Quick Run Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-cyan-500/30 p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">One-Line Linux Bash Installer</h3>
                  <p className="text-xs text-slate-400">Downloads dependencies, installs /usr/local/bin/autoscribe, and probes latency</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                curl | bash
              </span>
            </div>

            <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-cyan-300 flex items-center justify-between">
              <code>{linuxOneClick}</code>
              <button
                onClick={() => copyToClipboard(linuxOneClick, 'linux-oneclick')}
                className="ml-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs flex items-center gap-1.5 shrink-0"
              >
                {copiedSection === 'linux-oneclick' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedSection === 'linux-oneclick' ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>
          </div>

          {/* Location Name vs Region Explanation Box */}
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Zap className="w-4 h-4" />
              <span>City Location Names vs Regions in Linux Bash</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>Why did it only show regions before?</strong> The official <code>windscribe-cli locations</code> command only outputs broad regions (e.g. <em>US Central</em>, <em>Germany</em>) by default. To see individual city locations with official CLI, you have to query by region: <code>windscribe-cli locations "US Central"</code>.
            </p>
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-slate-200 space-y-1">
              <div className="text-emerald-400 font-semibold font-sans">AutoScribe now displays both Region and City Location Name:</div>
              <div>• <code>autoscribe</code> — Runs latency benchmark showing <strong>Region</strong>, <strong>City</strong> (Dallas, Chicago, London...), <strong>Nickname</strong>, and <strong>IP</strong>!</div>
              <div>• <code>autoscribe locations</code> — Prints all 75+ regions AND individual city locations in a clean tree.</div>
              <div>• <code>autoscribe connect "Dallas"</code> — Connects directly to any specific city.</div>
            </div>
          </div>

          {/* Linux Distro Guides Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ubuntu / Debian */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-xs">
                    deb
                  </span>
                  <h4 className="text-sm font-bold text-white">Ubuntu / Debian / Mint / Pop!_OS</h4>
                </div>
                <button
                  onClick={() => copyToClipboard(linuxAptSetup, 'linux-apt')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Copy Commands"
                >
                  {copiedSection === 'linux-apt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Configures official Windscribe APT repository and installs windscribe-cli:</p>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-48 leading-relaxed">
                <pre>{linuxAptSetup}</pre>
              </div>
            </div>

            {/* Arch Linux */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs">
                    aur
                  </span>
                  <h4 className="text-sm font-bold text-white">Arch Linux / Manjaro / EndeavourOS</h4>
                </div>
                <button
                  onClick={() => copyToClipboard(linuxArchSetup, 'linux-arch')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Copy Commands"
                >
                  {copiedSection === 'linux-arch' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Installs from AUR via yay and enables windscribe-helper service:</p>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-48 leading-relaxed">
                <pre>{linuxArchSetup}</pre>
              </div>
            </div>
          </div>

          {/* Linux Script Download & Inspection */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h4 className="text-sm font-bold text-white">Direct Script File (autoscribe-linux.sh)</h4>
                <p className="text-xs text-slate-400">Standalone bash script ready to chmod +x and run locally</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/api/autoscribe-linux.sh"
                  download="autoscribe-linux.sh"
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs transition inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-black" />
                  <span>Download Script</span>
                </a>
              </div>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Features included:</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Auto-detection of system architecture (x86_64, aarch64, ARM)</li>
                <li>Live multi-node ICMP/TCP ping probing</li>
                <li>Automatic failover and fastest node selection</li>
                <li>Integration with native <code>windscribe-cli</code> and WireGuard tools</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* OS CONTENT: MACOS TERMINAL */}
      {activeOs === 'macos' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* macOS Quick Run Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-purple-500/30 p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">One-Line macOS Terminal Runner</h3>
                  <p className="text-xs text-slate-400">Supports Apple Silicon (M1/M2/M3/M4) and Intel Macs</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                curl | bash
              </span>
            </div>

            <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-purple-300 flex items-center justify-between">
              <code>{macosOneClick}</code>
              <button
                onClick={() => copyToClipboard(macosOneClick, 'macos-oneclick')}
                className="ml-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs flex items-center gap-1.5 shrink-0"
              >
                {copiedSection === 'macos-oneclick' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedSection === 'macos-oneclick' ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>
          </div>

          {/* macOS Detailed Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Install with Homebrew */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-xs">
                    1
                  </span>
                  <h4 className="text-sm font-bold text-white">Install via Homebrew & Path Symlink</h4>
                </div>
                <button
                  onClick={() => copyToClipboard(macosBrewSetup, 'macos-brew')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Copy Homebrew Commands"
                >
                  {copiedSection === 'macos-brew' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Install Windscribe for macOS and expose the CLI binary:</p>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-48 leading-relaxed">
                <pre>{macosBrewSetup}</pre>
              </div>
            </div>

            {/* Step 2: Architecture & IPC Notes */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                    2
                  </span>
                  <h4 className="text-sm font-bold text-white">Apple Silicon & Terminal Notes</h4>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                On macOS, the official CLI lives inside the app bundle at:
                <code className="block mt-1 p-1 bg-slate-950 rounded text-cyan-300 font-mono text-[10px]">
                  /Applications/Windscribe.app/Contents/MacOS/windscribe-cli
                </code>
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                AutoScribe automatically detects both <strong>Apple Silicon (ARM64)</strong> and <strong>Intel (x86_64)</strong> Macs, uses native BSD ping, and configures the executable in <code className="text-slate-300">~/.local/bin/autoscribe</code>.
              </p>
            </div>
          </div>

          {/* macOS Script Download */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h4 className="text-sm font-bold text-white">Direct Script File (autoscribe-macos.sh)</h4>
                <p className="text-xs text-slate-400">Standalone bash script ready to chmod +x and run locally on macOS</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/api/autoscribe-macos.sh"
                  download="autoscribe-macos.sh"
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs transition inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Download autoscribe-macos.sh</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OS CONTENT: WINDOWS POWERSHELL */}
      {activeOs === 'windows' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Windows One-Click Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-blue-500/30 p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">One-Line Windows PowerShell Runner</h3>
                  <p className="text-xs text-slate-400">Open PowerShell and paste this command to benchmark and connect</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                irm | iex
              </span>
            </div>

            <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-blue-300 flex items-center justify-between">
              <code>{windowsOneClick}</code>
              <button
                onClick={() => copyToClipboard(windowsOneClick, 'win-oneclick')}
                className="ml-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs flex items-center gap-1.5 shrink-0"
              >
                {copiedSection === 'win-oneclick' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedSection === 'win-oneclick' ? 'Copied' : 'Copy PowerShell'}</span>
              </button>
            </div>
          </div>

          {/* Windows Detailed Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Install with winget */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs">
                    1
                  </span>
                  <h4 className="text-sm font-bold text-white">Install via Winget & Login</h4>
                </div>
                <button
                  onClick={() => copyToClipboard(windowsWingetInstall, 'win-winget')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Copy Winget Commands"
                >
                  {copiedSection === 'win-winget' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Install Windscribe for Windows using the Windows Package Manager:</p>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-48 leading-relaxed">
                <pre>{windowsWingetInstall}</pre>
              </div>
            </div>

            {/* Step 2: Set up persistent Alias */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                    2
                  </span>
                  <h4 className="text-sm font-bold text-white">Create PowerShell Profile Alias</h4>
                </div>
                <button
                  onClick={() => copyToClipboard(windowsProfileAlias, 'win-profile')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Copy Profile Command"
                >
                  {copiedSection === 'win-profile' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Adds an <code>autoscribe</code> function to your PowerShell profile so it is always available:</p>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-48 leading-relaxed">
                <pre>{windowsProfileAlias}</pre>
              </div>
            </div>
          </div>

          {/* Windows Script Download */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h4 className="text-sm font-bold text-white">Direct Script File (AutoScribe.ps1)</h4>
                <p className="text-xs text-slate-400">Execute directly with PowerShell: <code>powershell -ExecutionPolicy Bypass -File .\AutoScribe.ps1</code></p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/api/AutoScribe.ps1"
                  download="AutoScribe.ps1"
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold text-xs transition inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Download AutoScribe.ps1</span>
                </a>
              </div>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">How windscribe-cli works on Windows:</div>
              <p className="text-[11px] leading-relaxed">
                The Windows desktop client includes <code>C:\Program Files\Windscribe\windscribe-cli.exe</code> which controls the background Windows service via IPC. AutoScribe pings all endpoints, highlights the lowest latency server in color-coded output, and sends the connection request to the client.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OS CONTENT: ANDROID TERMUX */}
      {activeOs === 'android' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Warning Notice about Termux from Play Store */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-300">Important Termux Installation Requirement:</div>
              <p className="text-slate-300 leading-relaxed">
                Do <strong>NOT</strong> install Termux from Google Play Store (the Play Store build is deprecated and cannot update packages). Install Termux from <strong>F-Droid</strong> or the official <strong>GitHub releases</strong>.
              </p>
            </div>
          </div>

          {/* Android Quick Run Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/30 p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">One-Click Termux Script</h3>
                  <p className="text-xs text-slate-400">Installs curl, python, jq, wireguard-tools and runs AutoScribe</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Termux Native
              </span>
            </div>

            <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-emerald-300 overflow-x-auto">
              <pre>{androidOneClick}</pre>
              <button
                onClick={() => copyToClipboard(androidOneClick, 'android-oneclick')}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs flex items-center gap-1.5 shrink-0"
              >
                {copiedSection === 'android-oneclick' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedSection === 'android-oneclick' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Android PRoot Ubuntu */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                  CLI
                </span>
                <h4 className="text-sm font-bold text-white">Official windscribe-cli on Android (PRoot Container)</h4>
              </div>
              <button
                onClick={() => copyToClipboard(androidProotUbuntu, 'android-proot')}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Copy Commands"
              >
                {copiedSection === 'android-proot' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-slate-400">Runs the official desktop Linux <code>windscribe-cli</code> binary inside Termux without requiring root access:</p>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-48 leading-relaxed">
              <pre>{androidProotUbuntu}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
