#!/bin/bash
#
# Description: Runs the project's test suite.
# It ensures dependencies are installed before running tests.
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

# 2. Navigate to the project root to execute the test command.
cd "$PROJECT_ROOT"

# 3. Run the project's test script.
# The root package.json defines a "test" script for running the test suite.
# Any additional arguments passed to this script are forwarded to the test runner.
log_info "Running tests..."
pnpm run test "$@"