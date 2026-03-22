#!/bin/bash

# -----------------
# Color Constants
# -----------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# -----------------
# Helper Functions
# -----------------
print_step() {
    echo -e "${CYAN}> ${NC}${BOLD}$1${NC}"
}

print_success() {
    echo -e "${GREEN}v ${NC}$1"
}

print_error() {
    echo -e "${RED}x ${NC}$1"
}

check_docker() {
    if ! command -v docker &>/dev/null; then
        print_error "Docker not found. Install Docker and try again."
        exit 1
    fi
    if ! docker info &>/dev/null; then
        print_error "Docker daemon is not running. Start Docker and try again."
        exit 1
    fi
    if ! docker compose version &>/dev/null; then
        print_error "Docker Compose plugin not found. Update Docker Desktop or install the plugin."
        exit 1
    fi
}

# -----------------
# Splash Screen
# -----------------
clear
echo -e "${YELLOW}${BOLD}"
cat << "EOF"

██████  ██     ██ ███    ██  ██████  ██████  ██████  ████████ ███████ ██   ██ 
██   ██ ██     ██ ████   ██ ██      ██    ██ ██   ██    ██    ██       ██ ██  
██████  ██  █  ██ ██ ██  ██ ██      ██    ██ ██████     ██    █████     ███   
██      ██ ███ ██ ██  ██ ██ ██      ██    ██ ██   ██    ██    ██       ██ ██  
██       ███ ███  ██   ████  ██████  ██████  ██   ██    ██    ███████ ██   ██

by: brennocm (https://github.com/brennocm/pwncortex)

EOF
    echo -e "${NC}"
    echo -e "  ${BOLD} Pentest Workstation ${NC}"
    echo -e "  -------------------------------------------"
    echo ""

# Preflight checks
check_docker

# Stop containers (keeps volumes and containers for fast restart)
print_step "Stopping containers..."
if ! docker compose stop; then
    print_error "Failed to stop containers. Check 'docker compose ps' for details."
    exit 1
fi

echo ""
print_success "PwnCortex shut down successfully."
echo -e "  ${NC}Resources (CPU/RAM) released."
echo -e "  ${NC}To restart: ${CYAN}./start.sh${NC}"
echo ""
exit 0
