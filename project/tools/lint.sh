#!/bin/bash
#
# Description: Lints the project's source code.
# Output to stdout is exclusively in the specified JSON format.
# All other informational output is sent to stderr.
# Exits with a non-zero code if linting errors are found.
#

# --- Script Configuration ---
# Unset variables are an error.
set -u
# Pipes fail on the first error.
set -o pipefail
# We manage exit-on-error manually to capture the linter's exit code.

# --- Script Setup ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# --- Helper Functions ---
log_info() {
    echo "INFO: $1" >&2
}

log_error() {
    echo "ERROR: $1" >&2
}

# --- Main Logic ---
# 1. Ensure dependencies are installed, but silence the output to keep stdout clean.
log_info "Ensuring dependencies are installed..."
bash "${SCRIPT_DIR}/install.sh" >/dev/null 2>&1

# 2. Navigate to the project root.
cd "$PROJECT_ROOT"

# 3. Check for required tools for this script.
if ! command -v jq &> /dev/null; then
    log_error "jq could not be found, but it is required for formatting the output."
    log_error "Please install jq to continue."
    exit 1
fi

# 4. Ensure a linter (eslint) is available.
if ! pnpm exec --no-install eslint --version >/dev/null 2>&1; then
    log_info "ESLint not found. Attempting to install it as a dev dependency..."
    # Install eslint and common plugins for TypeScript projects.
    pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin >/dev/null 2>&1
    log_info "ESLint installed."
fi

# 5. Run the linter, capturing its JSON output and exit code.
log_info "Running linter..."
LINT_OUTPUT_FILE=$(mktemp)
# Disable 'exit on error' temporarily to capture the exit code.
set +e
# We run eslint directly to control the output format, bypassing the package.json script.
# --quiet ensures we only get errors, matching the "critical warnings" requirement.
pnpm exec eslint "apps/**/*.{js,ts,jsx,tsx}" "packages/**/*.{js,ts,jsx,tsx}" --format json --quiet > "$LINT_OUTPUT_FILE"
LINT_EXIT_CODE=$?
# Re-enable 'exit on error' for subsequent commands.
set -e

# 6. Transform the ESLint JSON output to the required custom format using jq.
# This produces a single JSON array. If there are no errors, it will be an empty array.
jq -c '
  [
    .[] | .filePath as $path | .messages[] |
    {
      "type": .ruleId,
      "path": $path,
      "obj": (.nodeType // "N/A"),
      "message": .message,
      "line": .line,
      "column": .column
    }
  ]
' "$LINT_OUTPUT_FILE"

# 7. Clean up the temporary file.
rm "$LINT_OUTPUT_FILE"

# 8. Exit with the original exit code from the linter.
# This will be 0 on success and non-zero if errors were found.
exit $LINT_EXIT_CODE