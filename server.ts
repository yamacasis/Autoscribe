import express from 'express';
import http from 'http';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FALLBACK_LOCATIONS, WindscribeLocation } from './src/data/fallbackServers.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory cache for locations
let cachedLocations: WindscribeLocation[] = FALLBACK_LOCATIONS;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchLatestLocations(): Promise<WindscribeLocation[]> {
  const now = Date.now();
  if (cachedLocations.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedLocations;
  }

  try {
    const timestamp = Math.floor(now / 1000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const [res0, res1] = await Promise.all([
      fetch(`https://assets.windscribe.com/serverlist/mob-v2/0/${timestamp}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Windscribe-Android/3.0.0' }
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`https://assets.windscribe.com/serverlist/mob-v2/1/${timestamp}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Windscribe-Android/3.0.0' }
      }).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);

    clearTimeout(timeout);

    const allData = [
      ...(res0?.data || []),
      ...(res1?.data || [])
    ];

    if (allData.length > 0) {
      const unique = new Map<number, WindscribeLocation>();
      for (const loc of allData) {
        if (!unique.has(loc.id)) {
          unique.set(loc.id, {
            id: loc.id,
            name: loc.name,
            country_code: loc.country_code,
            status: loc.status ?? 1,
            premium_only: loc.premium_only ?? 0,
            short_name: loc.short_name || loc.name.slice(0, 4),
            dns_hostname: loc.dns_hostname || '',
            groups: (loc.groups || []).map((g: any) => ({
              id: g.id,
              city: g.city || '',
              nick: g.nick || '',
              pro: g.pro ?? 0,
              gps: g.gps,
              tz: g.tz,
              wg_pubkey: g.wg_pubkey,
              wg_endpoint: g.wg_endpoint,
              ovpn_x509: g.ovpn_x509,
              ping_ip: g.ping_ip,
              link_speed: g.link_speed || '10000'
            }))
          });
        }
      }
      cachedLocations = Array.from(unique.values());
      lastFetchTime = now;
      console.log(`[AutoScribe] Updated live Windscribe locations: ${cachedLocations.length} locations`);
      return cachedLocations;
    }
  } catch (err) {
    console.warn('[AutoScribe] Error fetching live locations, using fallback cache:', err);
  }

  return cachedLocations;
}

// 1. Locations endpoint
app.get('/api/windscribe/locations', async (_req, res) => {
  try {
    const locations = await fetchLatestLocations();
    res.json({
      success: true,
      count: locations.length,
      data: locations,
      timestamp: Date.now()
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message, data: FALLBACK_LOCATIONS });
  }
});

// 2. TCP Ping prober
app.get('/api/windscribe/ping', (req, res) => {
  const targetIp = (req.query.ip as string) || '';
  const port = parseInt((req.query.port as string) || '443', 10);

  if (!targetIp) {
    return res.status(400).json({ success: false, error: 'Missing ip query parameter' });
  }

  const startTime = process.hrtime.bigint();
  const socket = new net.Socket();
  socket.setTimeout(2500);

  let responded = false;
  const finish = (latencyMs: number | null, error: string | null = null) => {
    if (responded) return;
    responded = true;
    socket.destroy();
    if (error || latencyMs === null) {
      res.json({ success: false, ip: targetIp, latencyMs: null, error: error || 'Timeout' });
    } else {
      res.json({ success: true, ip: targetIp, latencyMs });
    }
  };

  socket.connect(port, targetIp, () => {
    const endTime = process.hrtime.bigint();
    const diffMs = Number(endTime - startTime) / 1_000_000;
    finish(Math.round(diffMs * 10) / 10);
  });

  socket.on('error', (_err) => {
    // If connection was refused or reset, host still responded to SYN
    const endTime = process.hrtime.bigint();
    const diffMs = Number(endTime - startTime) / 1_000_000;
    if (diffMs < 2000) {
      finish(Math.round(diffMs * 10) / 10);
    } else {
      finish(null, 'Connection failed');
    }
  });

  socket.on('timeout', () => {
    finish(null, 'Ping timeout (>2500ms)');
  });
});

// 3. Speed test download chunk generator
const chunkCache = Buffer.alloc(2 * 1024 * 1024, 0xaa); // 2MB pre-allocated
app.get('/api/speedtest/chunk', (req, res) => {
  const sizeKb = Math.min(Math.max(parseInt((req.query.kb as string) || '1024', 10), 64), 5120);
  const bytes = sizeKb * 1024;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Length', bytes);

  if (bytes <= chunkCache.length) {
    res.end(chunkCache.subarray(0, bytes));
  } else {
    const buf = Buffer.alloc(bytes, 0xbb);
    res.end(buf);
  }
});

// 4. Speed test upload sink
app.post('/api/speedtest/upload', (req, res) => {
  let received = 0;
  req.on('data', chunk => {
    received += chunk.length;
  });
  req.on('end', () => {
    res.json({ success: true, receivedBytes: received });
  });
});

// 5. Current IP details
app.get('/api/my-ip', (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
  res.json({
    ip,
    userAgent: req.headers['user-agent'] || 'Unknown'
  });
});

// 6. Downloadable / Copyable AutoScribe scripts for Termux & Linux
app.get('/api/autoscribe.sh', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(`#!/usr/bin/env bash
# ========================================================
# AutoScribe - Automated Windscribe Location & Speed Checker
# Designed for Android (Termux) and Linux
# Repository: https://github.com/rasool-mrr/AutoScribe
# ========================================================
set -e

CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

echo -e "\${CYAN}====================================================\${NC}"
echo -e "\${CYAN}   AutoScribe: Windscribe Speed & Location Tester   \${NC}"
echo -e "\${CYAN}====================================================\${NC}"

# Check dependencies
command -v curl >/dev/null 2>&1 || { echo -e "\${RED}curl is required. Run 'pkg install curl' or 'apt install curl'\${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "\${YELLOW}Notice: jq is recommended. Run 'pkg install jq'\${NC}"; }

API_URL="https://assets.windscribe.com/serverlist/mob-v2/0/$(date +%s)"
echo -e "\${GREEN}[+] Fetching live Windscribe server locations...\${NC}"

LOCATIONS=$(curl -s -m 8 "$API_URL" || echo '{"data":[]}')
TOTAL=$(echo "$LOCATIONS" | grep -o '"id":' | wc -l || echo "0")

echo -e "\${GREEN}[+] Loaded \${TOTAL} Windscribe nodes.\${NC}"
echo -e "\${YELLOW}[?] Command Options:\${NC}"
echo " 1) Test top free locations ping"
echo " 2) Find lowest latency server"
echo " 3) Connect fastest with windscribe-cli"
echo " 4) Connect via OpenVPN / WireGuard"
echo " 5) Run full automated benchmark"

read -p "Select option (1-5, default 2): " choice
choice=\${choice:-2}

echo -e "\${GREEN}[+] Probing latency across Windscribe regions and city locations...\${NC}"

# Format: REGION|CITY|NICKNAME|IP
SERVERS=(
  "US Central|Dallas|Ranch|198.44.137.19"
  "US Central|Atlanta|Magic City|198.44.138.19"
  "US Central|Denver|Mile High|95.173.221.15"
  "US East|New York|Empire|135.136.3.66"
  "US East|Chicago|Wrigley|154.47.25.65"
  "US East|Miami|Vice|135.136.5.2"
  "US West|Los Angeles|Dogg|199.116.115.14"
  "US West|Seattle|Cobain|199.116.118.178"
  "Canada East|Toronto|Comfort Zone|198.54.133.150"
  "Canada West|Vancouver|Van Isle|199.116.118.178"
  "United Kingdom|London|Custard|185.156.175.75"
  "Germany|Frankfurt|Castle|185.220.101.40"
  "France|Paris|Seine|185.246.188.66"
  "Netherlands|Amsterdam|Tulip|185.242.6.5"
  "Switzerland|Zurich|Alps|185.232.22.40"
  "Hong Kong|Hong Kong|Victoria|103.251.166.5"
)

BEST_REG=""
BEST_CITY=""
BEST_NICK=""
BEST_PING=9999

printf "%-15s %-16s %-14s %-16s %-12s\\n" "REGION" "CITY (LOCATION)" "NICKNAME" "IP" "LATENCY"
echo "---------------------------------------------------------------------------------------"

for entry in "\${SERVERS[@]}"; do
  IFS='|' read -r reg city nick ip <<< "$entry"
  ping_res=$(ping -c 2 -W 1 "$ip" 2>/dev/null | tail -1 | awk -F '/' '{print $5}' || echo "")
  if [ -n "$ping_res" ]; then
    int_ping=\${ping_res%.*}
    printf "%-15s %-16s %-14s %-16s \\033[0;32m%s ms\\033[0m\\n" "$reg" "$city" "$nick" "$ip" "$ping_res"
    if [ "$int_ping" -lt "$BEST_PING" ]; then
      BEST_PING=$int_ping
      BEST_REG=$reg
      BEST_CITY=$city
      BEST_NICK=$nick
    fi
  else
    printf "%-15s %-16s %-14s %-16s \\033[0;31mTimeout\\033[0m\\n" "$reg" "$city" "$nick" "$ip"
  fi
done

echo "---------------------------------------------------------------------------------------"
if [ -n "$BEST_CITY" ]; then
  echo -e "\${GREEN}[🏆] FASTEST LOCATION: \${BEST_CITY} [\${BEST_NICK}] in Region '\${BEST_REG}' (\${BEST_PING} ms)\${NC}"
  if command -v windscribe >/dev/null 2>&1; then
    echo -e "\${YELLOW}[+] Connecting to \${BEST_REG} (\${BEST_CITY}) via windscribe-cli...\${NC}"
    windscribe connect "$BEST_REG" "$BEST_CITY"
  elif command -v windscribe-cli >/dev/null 2>&1; then
    echo -e "\${YELLOW}[+] Connecting to \${BEST_REG} (\${BEST_CITY}) via windscribe-cli...\${NC}"
    windscribe-cli connect "$BEST_REG" "$BEST_CITY"
  else
    echo -e "\${YELLOW}[i] windscribe-cli is not installed in this shell.\${NC}"
    echo "To connect, import the WireGuard/OpenVPN profile into your Android VPN app"
    echo "or install windscribe-cli inside proot-distro Ubuntu: 'proot-distro login ubuntu'"
  fi
else
  echo -e "\${RED}[!] Could not resolve fastest server. Check internet connection.\${NC}"
fi
`);
});

// Dedicated Linux Bash Installer & Executable Setup
app.get('/api/autoscribe-linux.sh', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(`#!/usr/bin/env bash
# ========================================================
# AutoScribe - Linux Installation & Runner
# Supports Ubuntu, Debian, Arch, Fedora, RHEL
# Repository: https://github.com/rasool-mrr/AutoScribe
# ========================================================
set -e

CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

echo -e "\${CYAN}====================================================\${NC}"
echo -e "\${CYAN}   AutoScribe: Linux Installer & Speed Engine       \${NC}"
echo -e "\${CYAN}   Repository: https://github.com/rasool-mrr/AutoScribe\${NC}"
echo -e "\${CYAN}====================================================\${NC}"

# 1. Detect Package Manager and Install Dependencies
echo -e "\${YELLOW}[*] Checking Linux prerequisites...\${NC}"
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq curl jq iputils-ping wireguard-tools openvpn resolvconf >/dev/null 2>&1 || true
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y curl jq iputils wireguard-tools openvpn >/dev/null 2>&1 || true
elif command -v pacman >/dev/null 2>&1; then
  sudo pacman -Sy --noconfirm curl jq iputils wireguard-tools openvpn >/dev/null 2>&1 || true
fi

# 2. Check Windscribe CLI installation
if ! command -v windscribe-cli >/dev/null 2>&1 && ! command -v windscribe >/dev/null 2>&1; then
  echo -e "\${YELLOW}[!] windscribe-cli not found. Installing official repo...\${NC}"
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://repo.windscribe.com/ubuntu/windscribe.gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/windscribe.gpg --yes 2>/dev/null || true
    echo "deb https://repo.windscribe.com/ubuntu focal main" | sudo tee /etc/apt/sources.list.d/windscribe-repo.list >/dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq windscribe-cli >/dev/null 2>&1 || echo -e "\${YELLOW}[i] If package install is restricted, OpenVPN/WireGuard fallbacks are ready.\${NC}"
  elif command -v pacman >/dev/null 2>&1; then
    echo -e "\${YELLOW}[i] For Arch Linux, install via AUR: 'yay -S windscribe-cli'\${NC}"
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf config-manager --add-repo https://repo.windscribe.com/rpm/windscribe.repo >/dev/null 2>&1 || true
    sudo dnf install -y windscribe-cli >/dev/null 2>&1 || true
  fi
else
  echo -e "\${GREEN}[✓] windscribe-cli is installed and ready.\${NC}"
fi

# 3. Install AutoScribe global command to ~/.local/bin or /usr/local/bin
TARGET_DIR="$HOME/.local/bin"
mkdir -p "$TARGET_DIR"

cat << 'EOF' > "$TARGET_DIR/autoscribe"
#!/usr/bin/env bash
# AutoScribe Linux Command
set -e
CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

SERVERS=(
  "US Central|Dallas|Ranch|198.44.137.19"
  "US Central|Atlanta|Magic City|198.44.138.19"
  "US Central|Denver|Mile High|95.173.221.15"
  "US East|New York|Empire|135.136.3.66"
  "US East|Chicago|Wrigley|154.47.25.65"
  "US East|Miami|Vice|135.136.5.2"
  "US West|Los Angeles|Dogg|199.116.115.14"
  "US West|Seattle|Cobain|199.116.118.178"
  "Canada East|Toronto|Comfort Zone|198.54.133.150"
  "Canada West|Vancouver|Van Isle|199.116.118.178"
  "United Kingdom|London|Custard|185.156.175.75"
  "Germany|Frankfurt|Castle|185.220.101.40"
  "France|Paris|Seine|185.246.188.66"
  "Netherlands|Amsterdam|Tulip|185.242.6.5"
  "Switzerland|Zurich|Alps|185.232.22.40"
  "Hong Kong|Hong Kong|Victoria|103.251.166.5"
)

# Subcommand: list all regions & specific cities
if [ "$1" == "locations" ] || [ "$1" == "cities" ] || [ "$1" == "list" ]; then
  echo -e "\${CYAN}=======================================================================================\${NC}"
  echo -e "\${CYAN}   AutoScribe: All Available Windscribe Server Locations & Cities                     \${NC}"
  echo -e "\${CYAN}=======================================================================================\${NC}"
  printf "%-16s %-18s %-16s %-16s\\n" "REGION" "CITY (LOCATION)" "NICKNAME" "IP ADDRESS"
  echo "---------------------------------------------------------------------------------------"
  for entry in "\${SERVERS[@]}"; do
    IFS='|' read -r reg city nick ip <<< "$entry"
    printf "%-16s %-18s %-16s %-16s\\n" "$reg" "$city" "$nick" "$ip"
  done
  echo "---------------------------------------------------------------------------------------"
  echo -e "\${YELLOW}[i] In official windscribe-cli, to see cities for a specific region run:\${NC}"
  echo -e "    windscribe-cli locations \\"<Region>\\" (e.g. windscribe-cli locations \\"US Central\\")"
  exit 0
fi

# Subcommand: connect to specific city
if [ "$1" == "connect" ] && [ -n "$2" ]; then
  TARGET_CITY="$2"
  MATCH_REG=""
  for entry in "\${SERVERS[@]}"; do
    IFS='|' read -r reg city nick ip <<< "$entry"
    if [[ "\${city,,}" == *"\${TARGET_CITY,,}"* ]]; then
      MATCH_REG="$reg"
      TARGET_CITY="$city"
      break
    fi
  done
  if [ -n "$MATCH_REG" ]; then
    echo -e "\${GREEN}[+] Connecting to \${MATCH_REG} - \${TARGET_CITY} via windscribe-cli...\${NC}"
    if command -v windscribe-cli >/dev/null 2>&1; then
      windscribe-cli connect "$MATCH_REG" "$TARGET_CITY"
    else
      windscribe connect "$MATCH_REG" "$TARGET_CITY"
    fi
  else
    echo -e "\${YELLOW}[+] Attempting direct connection to '\${TARGET_CITY}' via windscribe-cli...\${NC}"
    windscribe-cli connect "$TARGET_CITY" || true
  fi
  exit 0
fi

echo -e "\${CYAN}=======================================================================================\${NC}"
echo -e "\${CYAN}   AutoScribe: Probing latency for both Regions & City Locations                      \${NC}"
echo -e "\${CYAN}=======================================================================================\${NC}"

BEST_REG=""
BEST_CITY=""
BEST_NICK=""
BEST_PING=9999

printf "%-15s %-16s %-14s %-16s %-12s\\n" "REGION" "CITY (LOCATION)" "NICKNAME" "IP" "LATENCY"
echo "---------------------------------------------------------------------------------------"

for entry in "\${SERVERS[@]}"; do
  IFS='|' read -r reg city nick ip <<< "$entry"
  ping_res=$(ping -c 2 -W 1 "$ip" 2>/dev/null | tail -1 | awk -F '/' '{print $5}' || echo "")
  if [ -n "$ping_res" ]; then
    int_ping=\${ping_res%.*}
    printf "%-15s %-16s %-14s %-16s \\033[0;32m%s ms\\033[0m\\n" "$reg" "$city" "$nick" "$ip" "$ping_res"
    if [ "$int_ping" -lt "$BEST_PING" ]; then
      BEST_PING=$int_ping
      BEST_REG=$reg
      BEST_CITY=$city
      BEST_NICK=$nick
    fi
  else
    printf "%-15s %-16s %-14s %-16s \\033[0;31mTimeout\\033[0m\\n" "$reg" "$city" "$nick" "$ip"
  fi
done

echo "---------------------------------------------------------------------------------------"
if [ -n "$BEST_CITY" ]; then
  echo -e "\${GREEN}[🏆] FASTEST LOCATION: \${BEST_CITY} [\${BEST_NICK}] in Region '\${BEST_REG}' (\${BEST_PING} ms)\${NC}"
  if command -v windscribe-cli >/dev/null 2>&1; then
    echo -e "\${YELLOW}[+] Connecting via windscribe-cli...\${NC}"
    windscribe-cli connect "$BEST_REG" "$BEST_CITY"
  elif command -v windscribe >/dev/null 2>&1; then
    echo -e "\${YELLOW}[+] Connecting via windscribe...\${NC}"
    windscribe connect "$BEST_REG" "$BEST_CITY"
  else
    echo -e "\${YELLOW}[i] Run 'windscribe-cli login' to connect with official client.\${NC}"
  fi
fi
EOF

chmod +x "$TARGET_DIR/autoscribe"

# Add to PATH in ~/.bashrc or ~/.zshrc if not present
if [[ ":$PATH:" != *":$TARGET_DIR:"* ]]; then
  echo "export PATH=\\"\\$PATH:$TARGET_DIR\\"" >> "$HOME/.bashrc"
  [ -f "$HOME/.zshrc" ] && echo "export PATH=\\"\\$PATH:$TARGET_DIR\\"" >> "$HOME/.zshrc"
  export PATH="$PATH:$TARGET_DIR"
fi

echo -e "\${GREEN}[✓] AutoScribe successfully installed to \${TARGET_DIR}/autoscribe\${NC}"
echo -e "\${CYAN}[i] Usage:\${NC}"
echo -e "    autoscribe               Run latency benchmark and connect to fastest city"
echo -e "    autoscribe locations     List all available regions AND city location names"
echo -e "    autoscribe connect <city> Connect directly to any specific city (e.g. 'autoscribe connect Dallas')"
echo ""
echo -e "\${YELLOW}[*] Launching first benchmark test now:\${NC}"
"$TARGET_DIR/autoscribe"
`);
});

// Dedicated macOS Script & Runner
app.get('/api/autoscribe-macos.sh', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(`#!/usr/bin/env bash
# ========================================================
# AutoScribe - macOS Installation & Speed Benchmark Runner
# Supports Apple Silicon (M1/M2/M3/M4) & Intel Macs
# Repository: https://github.com/rasool-mrr/AutoScribe
# ========================================================
set -e

CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

echo -e "\${CYAN}====================================================\${NC}"
echo -e "\${CYAN}   AutoScribe: macOS Windscribe Speed Engine        \${NC}"
echo -e "\${CYAN}   Repository: https://github.com/rasool-mrr/AutoScribe\${NC}"
echo -e "\${CYAN}====================================================\${NC}"

ARCH=$(uname -m)
echo -e "\${GREEN}[+] Detected macOS Architecture: \${ARCH}\${NC}"

# 1. Locate Windscribe CLI on macOS
WS_APP_CLI="/Applications/Windscribe.app/Contents/MacOS/windscribe-cli"
WS_CLI=""

if command -v windscribe-cli >/dev/null 2>&1; then
  WS_CLI="windscribe-cli"
elif [ -f "$WS_APP_CLI" ]; then
  WS_CLI="$WS_APP_CLI"
  # Offer to symlink to PATH for user convenience
  if [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
    ln -sf "$WS_APP_CLI" /usr/local/bin/windscribe-cli 2>/dev/null || true
  elif [ -d "/opt/homebrew/bin" ] && [ -w "/opt/homebrew/bin" ]; then
    ln -sf "$WS_APP_CLI" /opt/homebrew/bin/windscribe-cli 2>/dev/null || true
  fi
fi

if [ -n "$WS_CLI" ]; then
  echo -e "\${GREEN}[✓] Found Windscribe CLI: \${WS_CLI}\${NC}"
else
  echo -e "\${YELLOW}[!] Windscribe not detected in /Applications.\${NC}"
  echo -e "\${YELLOW}[i] Install via Homebrew: 'brew install --cask windscribe' or download from windscribe.com\${NC}"
fi

# 2. Setup AutoScribe executable
TARGET_DIR="$HOME/.local/bin"
mkdir -p "$TARGET_DIR"

cat << 'EOF' > "$TARGET_DIR/autoscribe"
#!/usr/bin/env bash
# AutoScribe macOS Command
set -e
CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

# Find windscribe-cli on macOS
WS_CMD=""
if command -v windscribe-cli >/dev/null 2>&1; then
  WS_CMD="windscribe-cli"
elif [ -f "/Applications/Windscribe.app/Contents/MacOS/windscribe-cli" ]; then
  WS_CMD="/Applications/Windscribe.app/Contents/MacOS/windscribe-cli"
fi

SERVERS=(
  "US Central|Dallas|Ranch|198.44.137.19"
  "US Central|Atlanta|Magic City|198.44.138.19"
  "US Central|Denver|Mile High|95.173.221.15"
  "US East|New York|Empire|135.136.3.66"
  "US East|Chicago|Wrigley|154.47.25.65"
  "US East|Miami|Vice|135.136.5.2"
  "US West|Los Angeles|Dogg|199.116.115.14"
  "US West|Seattle|Cobain|199.116.118.178"
  "Canada East|Toronto|Comfort Zone|198.54.133.150"
  "Canada West|Vancouver|Van Isle|199.116.118.178"
  "United Kingdom|London|Custard|185.156.175.75"
  "Germany|Frankfurt|Castle|185.220.101.40"
  "France|Paris|Seine|185.246.188.66"
  "Netherlands|Amsterdam|Tulip|185.242.6.5"
  "Switzerland|Zurich|Alps|185.232.22.40"
  "Hong Kong|Hong Kong|Victoria|103.251.166.5"
)

# Subcommand: list all locations and cities
if [ "$1" == "locations" ] || [ "$1" == "cities" ] || [ "$1" == "list" ]; then
  echo -e "\${CYAN}=======================================================================================\${NC}"
  echo -e "\${CYAN}   AutoScribe: All Available Windscribe Server Locations & Cities (macOS)             \${NC}"
  echo -e "\${CYAN}=======================================================================================\${NC}"
  printf "%-16s %-18s %-16s %-16s\\n" "REGION" "CITY (LOCATION)" "NICKNAME" "IP ADDRESS"
  echo "---------------------------------------------------------------------------------------"
  for entry in "\${SERVERS[@]}"; do
    IFS='|' read -r reg city nick ip <<< "$entry"
    printf "%-16s %-18s %-16s %-16s\\n" "$reg" "$city" "$nick" "$ip"
  done
  echo "---------------------------------------------------------------------------------------"
  echo -e "\${YELLOW}[i] In official windscribe-cli, to see cities for a specific region run:\${NC}"
  echo -e "    windscribe-cli locations \\"<Region>\\" (e.g. windscribe-cli locations \\"US Central\\")"
  exit 0
fi

# Subcommand: connect to specific city
if [ "$1" == "connect" ] && [ -n "$2" ]; then
  TARGET_CITY="$2"
  MATCH_REG=""
  for entry in "\${SERVERS[@]}"; do
    IFS='|' read -r reg city nick ip <<< "$entry"
    if [[ "\${city,,}" == *"\${TARGET_CITY,,}"* ]]; then
      MATCH_REG="$reg"
      TARGET_CITY="$city"
      break
    fi
  done
  if [ -n "$MATCH_REG" ] && [ -n "$WS_CMD" ]; then
    echo -e "\${GREEN}[+] Connecting to \${MATCH_REG} - \${TARGET_CITY} via Windscribe CLI...\${NC}"
    "$WS_CMD" connect "$MATCH_REG" "$TARGET_CITY"
  elif [ -n "$WS_CMD" ]; then
    echo -e "\${YELLOW}[+] Connecting to '\${TARGET_CITY}' via Windscribe CLI...\${NC}"
    "$WS_CMD" connect "$TARGET_CITY" || true
  else
    echo -e "\${RED}[!] Windscribe CLI not found. Please install Windscribe.app\${NC}"
  fi
  exit 0
fi

echo -e "\${CYAN}=======================================================================================\${NC}"
echo -e "\${CYAN}   AutoScribe: Probing latency for macOS (Regions & City Locations)                   \${NC}"
echo -e "\${CYAN}=======================================================================================\${NC}"

BEST_REG=""
BEST_CITY=""
BEST_NICK=""
BEST_PING=9999

printf "%-15s %-16s %-14s %-16s %-12s\\n" "REGION" "CITY (LOCATION)" "NICKNAME" "IP" "LATENCY"
echo "---------------------------------------------------------------------------------------"

for entry in "\${SERVERS[@]}"; do
  IFS='|' read -r reg city nick ip <<< "$entry"
  # BSD ping timeout flag on macOS is -t 1 or -W 1000
  ping_res=$(ping -c 2 -t 1 "$ip" 2>/dev/null | tail -1 | awk -F '/' '{print $5}' || echo "")
  if [ -z "$ping_res" ]; then
    ping_res=$(ping -c 2 -W 1000 "$ip" 2>/dev/null | tail -1 | awk -F '/' '{print $5}' || echo "")
  fi

  if [ -n "$ping_res" ]; then
    int_ping=\${ping_res%.*}
    printf "%-15s %-16s %-14s %-16s \\033[0;32m%s ms\\033[0m\\n" "$reg" "$city" "$nick" "$ip" "$ping_res"
    if [ "$int_ping" -lt "$BEST_PING" ]; then
      BEST_PING=$int_ping
      BEST_REG=$reg
      BEST_CITY=$city
      BEST_NICK=$nick
    fi
  else
    printf "%-15s %-16s %-14s %-16s \\033[0;31mTimeout\\033[0m\\n" "$reg" "$city" "$nick" "$ip"
  fi
done

echo "---------------------------------------------------------------------------------------"
if [ -n "$BEST_CITY" ]; then
  echo -e "\${GREEN}[🏆] FASTEST LOCATION: \${BEST_CITY} [\${BEST_NICK}] in Region '\${BEST_REG}' (\${BEST_PING} ms)\${NC}"
  if [ -n "$WS_CMD" ]; then
    echo -e "\${YELLOW}[+] Connecting to \${BEST_REG} (\${BEST_CITY}) via Windscribe CLI...\${NC}"
    "$WS_CMD" connect "$BEST_REG" "$BEST_CITY"
    "$WS_CMD" status
  else
    echo -e "\${YELLOW}[i] Install Windscribe.app to connect automatically:\${NC}"
    echo -e "    brew install --cask windscribe"
  fi
fi
EOF

chmod +x "$TARGET_DIR/autoscribe"

# Add to PATH in ~/.zshrc or ~/.bash_profile if not present
if [[ ":$PATH:" != *":$TARGET_DIR:"* ]]; then
  [ -f "$HOME/.zshrc" ] && echo "export PATH=\\"\\$PATH:$TARGET_DIR\\"" >> "$HOME/.zshrc"
  [ -f "$HOME/.bash_profile" ] && echo "export PATH=\\"\\$PATH:$TARGET_DIR\\"" >> "$HOME/.bash_profile"
  export PATH="$PATH:$TARGET_DIR"
fi

echo -e "\${GREEN}[✓] AutoScribe successfully installed on macOS at \${TARGET_DIR}/autoscribe\${NC}"
echo -e "\${CYAN}[i] Usage:\${NC}"
echo -e "    autoscribe               Run latency benchmark and connect to fastest city"
echo -e "    autoscribe locations     List all available regions AND city location names"
echo -e "    autoscribe connect <city> Connect directly to any specific city (e.g. 'autoscribe connect Dallas')"
echo ""
echo -e "\${YELLOW}[*] Launching first benchmark test now:\${NC}"
"$TARGET_DIR/autoscribe"
`);
});

// Dedicated Windows PowerShell Installer & Script
app.get('/api/AutoScribe.ps1', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send('\uFEFF' + `# ========================================================
# AutoScribe - Windows PowerShell Speed & Location Checker
# Supports Windows 10 / 11 PowerShell 5.1 & PowerShell 7+
# Repository: https://github.com/rasool-mrr/AutoScribe
# ========================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   AutoScribe: Windows PowerShell Windscribe Benchmark    " -ForegroundColor Cyan
Write-Host "   Repository: https://github.com/rasool-mrr/AutoScribe   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Locate Windscribe CLI executable on Windows
$WindscribePaths = @(
    "C:\\Program Files\\Windscribe\\windscribe-cli.exe",
    "C:\\Program Files (x86)\\Windscribe\\windscribe-cli.exe",
    "$env:LOCALAPPDATA\\Programs\\Windscribe\\windscribe-cli.exe"
)

$CliPath = $null
foreach ($p in $WindscribePaths) {
    if (Test-Path -LiteralPath $p) {
        $CliPath = $p
        break
    }
}

if (-not $CliPath) {
    $cliInPath = Get-Command windscribe-cli.exe -ErrorAction SilentlyContinue
    if ($cliInPath) {
        $CliPath = $cliInPath.Source
    }
}

if ($CliPath) {
    Write-Host ("[OK] Found Windscribe CLI at: {0}" -f $CliPath) -ForegroundColor Green
} else {
    Write-Host "[!] Windscribe CLI not detected in standard directory." -ForegroundColor Yellow
    Write-Host "[i] Tip: Install with 'winget install Windscribe.Windscribe' or download from windscribe.com" -ForegroundColor DarkGray
}

# 2. Server nodes list
Write-Host "[*] Probing active server nodes and network latency..." -ForegroundColor Cyan

$Servers = @(
    [PSCustomObject]@{ Region = "US Central";     City = "Dallas";       Nick = "Ranch";        IP = "198.44.137.19" }
    [PSCustomObject]@{ Region = "US Central";     City = "Atlanta";      Nick = "Magic City";   IP = "198.44.138.19" }
    [PSCustomObject]@{ Region = "US Central";     City = "Denver";       Nick = "Mile High";    IP = "95.173.221.15" }
    [PSCustomObject]@{ Region = "US East";        City = "New York";     Nick = "Empire";       IP = "135.136.3.66" }
    [PSCustomObject]@{ Region = "US East";        City = "Chicago";      Nick = "Wrigley";      IP = "154.47.25.65" }
    [PSCustomObject]@{ Region = "US East";        City = "Miami";        Nick = "Vice";         IP = "135.136.5.2" }
    [PSCustomObject]@{ Region = "US West";        City = "Los Angeles";  Nick = "Dogg";         IP = "199.116.115.14" }
    [PSCustomObject]@{ Region = "US West";        City = "Seattle";      Nick = "Cobain";       IP = "199.116.118.178" }
    [PSCustomObject]@{ Region = "Canada East";    City = "Toronto";      Nick = "Comfort Zone"; IP = "198.54.133.150" }
    [PSCustomObject]@{ Region = "Canada West";    City = "Vancouver";    Nick = "Van Isle";     IP = "199.116.118.178" }
    [PSCustomObject]@{ Region = "United Kingdom"; City = "London";       Nick = "Custard";      IP = "185.156.175.75" }
    [PSCustomObject]@{ Region = "Germany";        City = "Frankfurt";    Nick = "Castle";       IP = "185.220.101.40" }
    [PSCustomObject]@{ Region = "France";         City = "Paris";        Nick = "Seine";        IP = "185.246.188.66" }
    [PSCustomObject]@{ Region = "Netherlands";    City = "Amsterdam";    Nick = "Tulip";        IP = "185.242.6.5" }
    [PSCustomObject]@{ Region = "Switzerland";    City = "Zurich";       Nick = "Alps";         IP = "185.232.22.40" }
    [PSCustomObject]@{ Region = "Hong Kong";      City = "Hong Kong";    Nick = "Victoria";     IP = "103.251.166.5" }
)

$Results = @()
Write-Host ("{0,-15} {1,-18} {2,-15} {3,-16} {4,-10}" -f "REGION", "CITY (LOCATION)", "NICKNAME", "IP ADDRESS", "PING")
Write-Host "---------------------------------------------------------------------------------------" -ForegroundColor DarkGray

foreach ($entry in $Servers) {
    $reg = $entry.Region
    $city = $entry.City
    $nick = $entry.Nick
    $ip = $entry.IP

    $pingTime = $null
    try {
        $ping = Test-Connection -ComputerName $ip -Count 2 -Quiet -ErrorAction SilentlyContinue
        if ($ping) {
            $test = Test-Connection -ComputerName $ip -Count 2 -ErrorAction SilentlyContinue |
                    Measure-Object -Property ResponseTime -Average
            if ($test.Average) {
                $pingTime = [math]::Round($test.Average)
            }
        }
    } catch {
        $pingTime = $null
    }

    if ($null -ne $pingTime) {
        $color = if ($pingTime -lt 70) { "Green" } elseif ($pingTime -lt 140) { "Yellow" } else { "Magenta" }
        Write-Host ("{0,-15} {1,-18} {2,-15} {3,-16} " -f $reg, $city, $nick, $ip) -NoNewline
        Write-Host ("{0} ms" -f $pingTime) -ForegroundColor $color
        $Results += [PSCustomObject]@{
            Region = $reg
            City   = $city
            Nick   = $nick
            IP     = $ip
            PingMs = $pingTime
        }
    } else {
        Write-Host ("{0,-15} {1,-18} {2,-15} {3,-16} " -f $reg, $city, $nick, $ip) -NoNewline
        Write-Host "Timeout" -ForegroundColor Red
    }
}

Write-Host "---------------------------------------------------------------------------------------" -ForegroundColor DarkGray

if ($Results.Count -gt 0) {
    $Best = $Results | Sort-Object PingMs | Select-Object -First 1
    $bestCity = $Best.City
    $bestNick = $Best.Nick
    $bestReg = $Best.Region
    $bestPing = $Best.PingMs
    $bestIP = $Best.IP

    Write-Host ""
    Write-Host ("[BEST] FASTEST LOCATION: {0} [{1}] in Region '{2}' ({3} ms)" -f $bestCity, $bestNick, $bestReg, $bestPing) -ForegroundColor Green
    Write-Host ("     Target IP: {0}" -f $bestIP) -ForegroundColor Cyan
    Write-Host ""

    if ($CliPath) {
        $prompt = "Connect to {0} ({1}) now? (Y/n)" -f $bestCity, $bestReg
        $connectChoice = Read-Host $prompt
        if ($connectChoice -ne "n" -and $connectChoice -ne "N") {
            Write-Host "[+] Connecting via Windscribe CLI..." -ForegroundColor Yellow
            & $CliPath connect $bestReg $bestCity
            & $CliPath status
        }
    } else {
        Write-Host "[i] To connect automatically, install Windscribe and run:" -ForegroundColor DarkGray
        Write-Host ('    windscribe-cli.exe connect "' + $bestReg + '" "' + $bestCity + '"') -ForegroundColor Yellow
    }
} else {
    Write-Host "[!] Could not determine fastest server. Check network connection." -ForegroundColor Red
}
`);
});


// Vite middleware in dev or static files in prod
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AutoScribe] Server running on http://0.0.0.0:${PORT}`);
});
