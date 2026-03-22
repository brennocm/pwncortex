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

print_warning() {
    echo -e "${YELLOW}! ${NC}$1"
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
# Flags & Arguments
# -----------------
LLM_MODE=""
for arg in "$@"; do
    case $arg in
        --mode=*)
            LLM_MODE="${arg#*=}"
            ;;
    esac
done

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

# 0. Mode Selection
if [ -z "$LLM_MODE" ]; then
    echo -e "${BOLD}Select LLM Mode for Reset:${NC}"
    echo -e "  [1] ${BOLD}Local (Ollama)${NC}"
    echo -e "  [2] ${BOLD}API (OpenRouter)${NC}"
    echo -n "Choice [1/2]: "
    read -t 15 choice
    case $choice in
        2) LLM_MODE="api" ;;
        *) LLM_MODE="local" ;;
    esac
    echo ""
fi

case $LLM_MODE in
    local) 
        export COMPOSE_PROFILES="local"
        export LLM_PROVIDER="ollama"
        ;;
    api)
        export COMPOSE_PROFILES="api"
        export LLM_PROVIDER="openrouter"
        ;;
    *)
        print_error "Invalid mode: $LLM_MODE"
        exit 1
        ;;
esac

# Preflight checks
check_docker

print_warning "Initiating Controlled Reset of PwnCortex ($LLM_MODE)..."
echo -e "  ${NC}Containers and images will be removed and rebuilt."
echo -e "  ${GREEN}Your pentest projects, uploads, and Ollama models are SAFE.${NC}"
echo ""

# 1. Stop all running containers
print_step "1/3 Stopping containers..."
if ! docker compose stop; then
    print_error "Failed to stop containers."
    exit 1
fi

# 2. Remove containers (volumes preserved: pwncortex-db, pwncortex-uploads, ollama-models)
print_step "2/3 Removing containers and clearing image cache..."
if ! docker compose down --rmi local; then
    print_error "Failed to remove containers/images."
    exit 1
fi

# 3. Rebuild images and start fresh
print_step "3/3 Rebuilding images and starting stack..."
if ! docker compose up --build --force-recreate -d; then
    print_error "Failed to rebuild/start the stack. Check 'docker compose logs' for details."
    exit 1
fi

echo ""
print_success "Reset completed successfully!"
echo -e "  ${NC}Status: PwnCortex is running, fully refreshed."
echo -e "  ${NC}Web: ${CYAN}http://localhost:80${NC}"
echo -e "  ${NC}API: ${CYAN}http://localhost:8000${NC}"
echo ""
exit 0
