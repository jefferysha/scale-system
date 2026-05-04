#!/usr/bin/env bash
# =============================================================================
# serial-bridge.sh — 把宿主机 USB 串口透明桥接成 TCP，让 Mac/Win Docker 内的
# API container 通过 host.docker.internal:6500 读到真天平的字节流。
#
# 为什么要这个：Mac/Win Docker Desktop 跑在 Hypervisor 虚拟机里，--device
# 参数对 USB 串口无效，必须由宿主机起一层 TCP 桥（业界 Mac 开发者标准做法）。
#
# 用法：
#   ./scripts/dev/serial-bridge.sh                    # 自动找第一个 USB 串口
#   ./scripts/dev/serial-bridge.sh /dev/cu.usbserial-AB01
#   BAUD=4800 ./scripts/dev/serial-bridge.sh          # 自定义波特率
#   PORT=6500 ./scripts/dev/serial-bridge.sh          # 自定义 TCP 端口
# =============================================================================
set -euo pipefail

PORT="${PORT:-6500}"
BAUD="${BAUD:-9600}"
DATA_BITS="${DATA_BITS:-8}"
STOP_BITS="${STOP_BITS:-1}"
PARITY="${PARITY:-none}"  # none | even | odd

# ── 1. 检查 socat ─────────────────────────────────────────────────────────
if ! command -v socat >/dev/null 2>&1; then
  echo "❌ socat 未安装。"
  echo "   macOS:  brew install socat"
  echo "   Linux:  sudo apt-get install socat"
  exit 1
fi

# ── 2. 找串口 ─────────────────────────────────────────────────────────────
SERIAL_DEV="${1:-}"
if [ -z "$SERIAL_DEV" ]; then
  case "$(uname -s)" in
    Darwin)
      # 优先级：usbserial > SLAB (CP210x) > usbmodem
      SERIAL_DEV=$(ls /dev/cu.usbserial-* /dev/cu.SLAB_* /dev/cu.usbmodem* 2>/dev/null | head -n1 || true)
      ;;
    Linux)
      SERIAL_DEV=$(ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null | head -n1 || true)
      ;;
    *)
      echo "❌ 不支持的平台：$(uname -s)。请显式传 device 参数。"
      exit 1
      ;;
  esac
  if [ -z "$SERIAL_DEV" ]; then
    echo "❌ 未发现串口设备。请插上天平后重试，或显式传 device 路径。"
    echo "   macOS 列设备：ls /dev/cu.*"
    echo "   Linux 列设备：ls /dev/tty*"
    exit 1
  fi
fi

if [ ! -e "$SERIAL_DEV" ]; then
  echo "❌ 串口设备不存在：$SERIAL_DEV"
  exit 1
fi

# ── 3. parity 转换为 socat 参数 ───────────────────────────────────────────
case "$PARITY" in
  none) PARITY_OPT="parenb=0" ;;
  even) PARITY_OPT="parenb=1,parodd=0" ;;
  odd)  PARITY_OPT="parenb=1,parodd=1" ;;
  *)    echo "❌ PARITY 必须是 none|even|odd"; exit 1 ;;
esac

# ── 4. 信息输出 ───────────────────────────────────────────────────────────
cat <<INFO
╔═══════════════════════════════════════════════════════════════╗
║  Serial Bridge — 宿主机串口转 TCP                             ║
╠═══════════════════════════════════════════════════════════════╣
║  Device   : $SERIAL_DEV
║  Baud     : $BAUD
║  Frame    : ${DATA_BITS}${PARITY:0:1}${STOP_BITS}     (8N1 / 7E1 / 8O1 …)
║  Listen   : tcp://0.0.0.0:$PORT
║                                                               ║
║  → docker 容器内 SCALE_DEFAULT_TRANSPORT 配置：               ║
║     socket://host.docker.internal:$PORT                       ║
║                                                               ║
║  Ctrl-C 停止                                                  ║
╚═══════════════════════════════════════════════════════════════╝
INFO

# ── 5. 起 socat 桥 ────────────────────────────────────────────────────────
# 关键参数：
#   raw,echo=0  把串口设成原始模式（不做行缓冲、不回显）
#   reuseaddr   允许 Ctrl-C 后立即重启
#   fork        每个 TCP 连接 fork 一份（虽然真天平串口同一时间只能被一个进程读）
exec socat -d \
  TCP-LISTEN:$PORT,reuseaddr,fork,bind=0.0.0.0 \
  FILE:$SERIAL_DEV,b$BAUD,cs$DATA_BITS,cstopb=$((STOP_BITS-1)),$PARITY_OPT,raw,echo=0
