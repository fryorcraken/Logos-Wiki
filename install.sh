#!/bin/sh
# Install and start Logos Wiki:
#   curl -fsSL https://raw.githubusercontent.com/uNexpectedR/Logos-Wiki/main/install.sh | sh
# Options (environment): LOGOS_WIKI_DIR, LOGOS_WIKI_REPO, LOGOS_WIKI_REF, LOGOS_WIKI_SERVICE=1 (systemd user service),
# WIKI_ADMIN_NAME and WIKI_ADMIN_PASSWORD (non-interactive admin setup).
set -eu

REPO="${LOGOS_WIKI_REPO:-https://github.com/uNexpectedR/Logos-Wiki.git}"
DIR="${LOGOS_WIKI_DIR:-$HOME/logos-wiki}"
REF="${LOGOS_WIKI_REF:-main}"
LOGOSCTL_VERSION="0.3.2"
LOGOSCTL_URL="https://github.com/logos-co/logos-logoscore-cli/releases/download/$LOGOSCTL_VERSION"
export PATH="$HOME/.local/bin:$HOME/.local/logosctl/bin:$PATH"

die() { echo "error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }
sha256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }

check_tools() {
  for tool in git curl tar node npm; do need "$tool"; done
  node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 6) ? 0 : 1)' ||
    die "Node.js 22.6 or newer is required"
}

logosctl_asset() {
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) echo "logosctl-x86_64-linux.tar.gz 294fbcc6409a8851b7471582bdad2dbfaf681b5d1c67dfffec38ada925dc6762" ;;
    Linux-aarch64 | Linux-arm64) echo "logosctl-aarch64-linux.tar.gz e77ccd9c1a7e673c1a5533f2bcda03f84fd04e80f415ac414c378a897e5135fe" ;;
    Darwin-arm64) echo "logosctl-aarch64-macos.tar.gz f78e8ffdb88e44db1733d43cdea66e7bf558a799fac4f9b88748680f53d79a71" ;;
    *) die "no logosctl build for $(uname -s) $(uname -m)" ;;
  esac
}

install_logosctl() {
  command -v logosctl >/dev/null 2>&1 && return
  asset="$(logosctl_asset)"
  set -- $asset
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/$1" "$LOGOSCTL_URL/$1"
  [ "$(sha256 "$tmp/$1")" = "$2" ] || die "logosctl checksum mismatch"
  tar -xzf "$tmp/$1" -C "$tmp"
  if [ -d "$tmp/logosctl-aarch64-macos" ]; then
    mkdir -p "$HOME/.local" && rm -rf "$HOME/.local/logosctl" && mv "$tmp/logosctl-aarch64-macos" "$HOME/.local/logosctl"
  else
    mkdir -p "$HOME/.local/bin" && install -m755 "$tmp"/logosctl-*.AppImage "$HOME/.local/bin/logosctl"
  fi
  rm -rf "$tmp"
}

MODULES="
storage_module 3.0.2 49accbb8e538bc13bc910d3857e4caffac53da079e72fced0ecc9695d380923a
delivery_module 0.3.2 9b856418fcf816961f1118f34b395bb6a399e5523166be51f4eca6a7aaf76867
libp2p_module 1.1.0 28f296e1f4cdd349c672600077c6e39ab54fc439d49c965b6e35e3446844fd4c
liblogos_rln_module 0.12.0 fed1bdf371a37e25ad335d59d8914a5d6016d78de8ecf48cd7b6fb4b9f65bc8a
liblogos_lez_rln_module 5.1.0 7317c72e3848549c00a33fb3b0ddfd29d4cab41a437d755a4681883dfd49707f
"

install_modules() {
  installed="$(logosctl --json package ls)"
  tmp="$(mktemp -d)"
  echo "$MODULES" | while read -r name version sum; do
    [ -n "$name" ] || continue
    echo "$installed" | grep -q "\"name\":\"$name\"" && continue
    file="$tmp/$name-$version.lgx"
    curl -fsSL -o "$file" "https://github.com/logos-co/logos-modules-release/releases/download/$name-v$version/$name-$version.lgx"
    [ "$(sha256 "$file")" = "$sum" ] || die "$name checksum mismatch"
  done
  if ls "$tmp"/*.lgx >/dev/null 2>&1; then logosctl install --dir "$tmp" -y; fi
  rm -rf "$tmp"
}

start_logos() {
  if [ "$(uname -s)" = Linux ] && [ ! -e /dev/fuse ]; then export APPIMAGE_EXTRACT_AND_RUN=1; fi
  logosctl status >/dev/null 2>&1 || logosctl daemon start -d
  install_modules
}

fetch_app() {
  if [ -d "$DIR/.git" ]; then
    git -C "$DIR" fetch -q origin "$REF" && git -C "$DIR" checkout -q FETCH_HEAD
  else
    git clone -q --branch "$REF" "$REPO" "$DIR"
  fi
}

configure() {
  env="$DIR/.env.local"
  grep -q '^WIKI_ADMIN_KEY=' "$env" 2>/dev/null && return
  echo "Choose the admin account. You will log in to the wiki with this name and password."
  if [ -n "${WIKI_ADMIN_PASSWORD:-}" ]; then key="$(cd "$DIR" && npm run -s admin-key)"; else key="$(cd "$DIR" && npm run -s admin-key </dev/tty)"; fi
  umask 077
  {
    echo "$key"
    echo "LOGOSCTL=$(command -v logosctl)"
    if [ -n "${APPIMAGE_EXTRACT_AND_RUN:-}" ]; then echo "APPIMAGE_EXTRACT_AND_RUN=1"; fi
  } >>"$env"
}

build() {
  cd "$DIR"
  npm ci --no-audit --no-fund
  configure
  npm run build
}

install_service() {
  need systemctl
  unit="$HOME/.config/systemd/user/logos-wiki.service"
  mkdir -p "$(dirname "$unit")"
  cat >"$unit" <<EOF
[Unit]
Description=Logos Wiki
After=network-online.target

[Service]
WorkingDirectory=$DIR
Environment=PATH=$PATH
ExecStartPre=-$(command -v logosctl) daemon start -d
ExecStart=$(command -v npm) start
Restart=on-failure

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now logos-wiki
  echo "Logos Wiki runs as a service on http://localhost:3000 (run 'loginctl enable-linger' to keep it up after logout)."
}

main() {
  check_tools
  install_logosctl
  start_logos
  fetch_app
  build
  echo "To copy the original wiki once it is running: cd $DIR && npm run import"
  if [ "${LOGOS_WIKI_SERVICE:-}" = 1 ]; then install_service; else echo "Starting on http://localhost:3000" && exec npm start; fi
}

main
