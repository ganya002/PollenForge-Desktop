#!/bin/bash
# PollenForge Desktop - Development Start Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
BACKEND_PORT=8765

echo "╔══════════════════════════════════════╗"
echo "║     PollenForge Desktop v1.0         ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Start backend
echo "Starting Python backend on port $BACKEND_PORT..."
cd "$BACKEND_DIR"
.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port $BACKEND_PORT &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:$BACKEND_PORT/health > /dev/null 2>&1; then
        echo "✓ Backend ready"
        break
    fi
    sleep 0.5
done

# Start frontend (Vite dev server)
echo "Starting Vite dev server..."
cd "$SCRIPT_DIR"
npx vite --port 5173 &
VITE_PID=$!

# Wait for Vite
sleep 3

# Start Electron
echo "Starting Electron..."
npx electron . &
ELECTRON_PID=$!

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  PollenForge is running!             ║"
echo "║  Backend: http://localhost:$BACKEND_PORT     ║"
echo "║  Frontend: http://localhost:5173     ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $ELECTRON_PID 2>/dev/null || true
    kill $VITE_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    wait
    echo "Done."
}
trap cleanup EXIT INT TERM

# Wait for Electron to close
wait $ELECTRON_PID
