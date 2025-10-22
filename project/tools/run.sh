#!/bin/bash
#
# Description: Runs the main project application in development mode.
# It ensures dependencies are installed before running.
#

# --- Script Configuration ---
set -e
set -u
set -o pipefail

# --- Script Setup ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# --- Helper Functions ---
log_info() {
    echo "INFO: $1" >&2
}

# --- Main Logic ---
# 1. Ensure the environment and dependencies are correctly set up by calling install.sh.
log_info "Running install script to ensure dependencies are up to date..."
bash "${SCRIPT_DIR}/install.sh"

# 2. Navigate to the project root to execute the run command.
cd "$PROJECT_ROOT"

# 3. Run the project's development script.
# The root package.json defines a "dev" script, which is the conventional command to start the project.
# Any additional arguments passed to this script are forwarded to the 'pnpm run dev' command.
log_info "Starting the project..."
pnpm run dev "$@"