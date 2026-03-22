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

# -----------------
# Flags & Arguments
# -----------------
DEV_MODE=0
DRY_RUN=0
LLM_MODE=""

for arg in "$@"; do
    case $arg in
        --dev)
            DEV_MODE=1
            ;;
        --dry-run)
            DRY_RUN=1
            ;;
        --mode=*)
            LLM_MODE="${arg#*=}"
            ;;
    esac
done

# -----------------
# Splash Screen
# -----------------
if [ "$DRY_RUN" != "1" ]; then
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
fi

# -----------------
# Execution Start
# -----------------

if [ "$DRY_RUN" != "1" ]; then
    print_step "Performing system checks..."

    # 1. Check Docker
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running."
        echo -e "  Start Docker and try again."
        exit 1
    fi
    print_success "Docker Engine is active."
fi

# -----------------
# Mode Selection
# -----------------
if [ -z "$LLM_MODE" ]; then
    echo -e "${BOLD}Select LLM Mode (15s timeout):${NC}"
    echo -e "  [1] ${BOLD}Local (Ollama)${NC} - Full stack, includes Ollama container (Default)"
    echo -e "  [2] ${BOLD}API (OpenRouter)${NC} - Slim stack, uses remote API"
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
        MODE_DISPLAY="Local (Ollama)"
        ;;
    api)
        export COMPOSE_PROFILES="api"
        export LLM_PROVIDER="openrouter"
        MODE_DISPLAY="OpenRouter (API)"
        if [ -z "$OPENROUTER_API_KEY" ]; then
            print_warning "OPENROUTER_API_KEY not found in environment."
            echo -e "  ${NC}Ensure it is configured in the web settings."
        fi
        ;;
    *)
        print_error "Invalid mode: $LLM_MODE"
        echo -e "  Use --mode=local or --mode=api"
        exit 1
        ;;
esac

if [ "$DRY_RUN" = "1" ]; then
    echo "COMPOSE_PROFILES=$COMPOSE_PROFILES"
    echo "LLM_PROVIDER=$LLM_PROVIDER"
    echo "LLM: $MODE_DISPLAY"
    exit 0
fi

# 2. Decide compose files
if [ "$DEV_MODE" = "1" ]; then
    print_warning "Dev mode: hot reload enabled (API :8000, Web :5173)"
    COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
else
    COMPOSE_CMD="docker compose"
fi

echo ""
print_step "Igniting PwnCortex containers ($MODE_DISPLAY)..."
echo -e "  ${NC}Building images and starting services."
if [ "$LLM_MODE" = "local" ]; then
    echo -e "  ${NC}First run may take a few minutes (Ollama model download)."
fi
echo ""

# 3. Start stack
if $COMPOSE_CMD up --build -d; then
    echo ""
    echo -e "${YELLOW}${BOLD}=================================================${NC}"
    echo -e "${YELLOW}${BOLD}            PWNCORTEX IS ONLINE                  ${NC}"
    echo -e "${YELLOW}${BOLD}=================================================${NC}"
    echo ""
    if [ "$DEV_MODE" = "1" ]; then
        echo -e "  ${BOLD}Web (Vite)${NC}    ${CYAN}http://localhost:5173${NC}"
    else
        echo -e "  ${BOLD}Web${NC}           ${CYAN}http://localhost:80${NC}"
    fi
    echo -e "  ${BOLD}API${NC}           ${CYAN}http://localhost:8000${NC}"
    if [ "$LLM_MODE" = "local" ]; then
        echo -e "  ${BOLD}Ollama${NC}        ${CYAN}http://localhost:11434${NC}"
    fi
    echo -e "  ${BOLD}LLM Mode${NC}      ${GREEN}${MODE_DISPLAY}${NC}"
    echo ""
    echo -e "  ${NC}To tail logs: ${BOLD}docker compose logs -f${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}${BOLD}=================================================${NC}"
    echo -e "${RED}${BOLD}          FAILED TO START PWNCORTEX              ${NC}"
    echo -e "${RED}${BOLD}=================================================${NC}"
    echo ""
    print_error "Build failed. Check errors above."
    echo -e "  ${NC}Full logs: ${BOLD}docker compose logs${NC}"
    echo ""
    exit 1
fi
