#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm no está instalado o no está en PATH."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Instalando dependencias..."
  npm install
fi

echo "Iniciando frontend en http://localhost:5173 ..."
npm run dev
