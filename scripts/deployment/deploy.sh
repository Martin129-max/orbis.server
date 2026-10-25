#!/usr/bin/env bash

set -e

export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

if ! command -v fly >/dev/null 2>&1; then
  echo "📦 Installing the Fly CLI..."
  curl -fsSL https://fly.io/install.sh | sh
fi

if ! fly auth whoami >/dev/null 2>&1; then
  echo "🔑 Logging in to Fly..."
  fly auth login
fi

echo "🚀 Deploying to Fly..."
fly deploy --ha=false "$@"
