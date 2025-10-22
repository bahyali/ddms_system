#!/bin/bash
#
# Description: Installs all project dependencies using pnpm.
# This script is idempotent and can be run safely multiple times.
#

# --- Script Configuration ---
# Exit immediately if a command exits with a non-zero status.
set -e
# Treat unset variables as an error when substituting.
set -u
# Pipes fail on the first error, not the last command.
set -o pipefail

# --- Script Setup ---
# Get the absolute path of the directory containing this script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
# The project root is one level above the 'tools' directory.
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# --- Helper Functions ---
# A function to print informational messages to stderr.
log_info() {
    echo "INFO: $1" >&2
}

# A function to print error messages to stderr.
log_error() {
    echo "ERROR: $1" >&2
}

# --- Main Logic ---
# Navigate to the project root to ensure commands run in the correct context.
cd "$PROJECT_ROOT"

log_info "Ensuring project dependencies are installed..."

# 1. Check for the presence of pnpm, the project's package manager.
if ! command -v pnpm &> /dev/null; then
    log_error "pnpm could not be found. Please install pnpm to continue."
    log_error "You can often install it with 'npm install -g pnpm' or by enabling corepack: 'corepack enable'."
    exit 1
fi

# 2. Install dependencies using pnpm.
# 'pnpm install' is idempotent. It will only install missing packages or
# update based on the lockfile, making it safe to run every time.
log_info "Running 'pnpm install' to install/update dependencies for all workspaces..."
pnpm install

log_info "Project dependencies are successfully installed and up to date."