#!/usr/bin/env bash
# install.sh - One-liner installer for ShipSec Studio (Production/Docker mode)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ShipSecAI/studio/main/install.sh | bash
#
# This script installs ShipSec Studio using pre-built Docker images from GHCR.
# For development setup, see: https://github.com/ShipSecAI/studio#option-3-development-setup
#
# Supported platforms: macOS, Linux, Windows (Git Bash/MSYS2/WSL)

set -u -o pipefail
IFS=$'\n\t'

# ---------- Config ----------
REPO_URL="https://github.com/ShipSecAI/studio"
REPO_DIR="studio"
WAIT_DOCKER_SEC=60

# ---------- Colors ----------
setup_colors() {
  if [[ -t 1 ]] && [[ -n "${TERM:-}" ]]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    CYAN='\033[0;36m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
  else
    GREEN=''
    YELLOW=''
    RED=''
    CYAN=''
    BLUE=''
    BOLD=''
    NC=''
  fi
}
setup_colors

# ---------- Logging ----------
log()  { printf "\n${GREEN}==>${NC} ${BOLD}%s${NC}\n" "$1"; }
info() { printf "    %s\n" "$1"; }
warn() { printf "    ${YELLOW}Warning:${NC} %s\n" "$1"; }
err()  { printf "    ${RED}Error:${NC} %s\n" "$1"; }

# ---------- Traps ----------
on_err() {
  local rc=$?
  printf "\n"
  err "Installation failed (exit code: $rc)"
  err "If you need help, please visit: https://github.com/ShipSecAI/studio/issues"
  exit $rc
}
on_int() {
  printf "\n"
  warn "Installation cancelled by user."
  exit 130
}
trap 'on_err' ERR
trap 'on_int' INT

# ---------- Utility ----------
command_exists() { command -v "$1" >/dev/null 2>&1; }

# Cross-platform user input
ask_yes_no() {
  local prompt="$1"
  local default="${2:-n}"
  local yn_hint
  
  if [ "$default" = "y" ]; then
    yn_hint="[Y/n]"
  else
    yn_hint="[y/N]"
  fi
  
  # Non-interactive mode (piped input)
  if [ ! -t 0 ]; then
    case "$default" in
      y|Y) return 0 ;;
      *) return 1 ;;
    esac
  fi
  
  while true; do
    printf "    %s %s " "$prompt" "$yn_hint"
    read -r ans || ans=""
    ans="${ans:-$default}"
    case "$ans" in
      y|Y|yes|YES|Yes) return 0 ;;
      n|N|no|NO|No) return 1 ;;
      *) printf "    Please enter 'y' for yes or 'n' for no.\n" ;;
    esac
  done
}

# ---------- Platform Detection ----------
detect_platform() {
  local os_raw
  os_raw="$(uname -s 2>/dev/null || echo Unknown)"
  
  case "$os_raw" in
    Darwin)
      PLATFORM="macos"
      PLATFORM_NAME="macOS"
      ;;
    Linux)
      if grep -qEi "(microsoft|wsl)" /proc/version 2>/dev/null; then
        PLATFORM="wsl"
        PLATFORM_NAME="Windows (WSL)"
      else
        PLATFORM="linux"
        PLATFORM_NAME="Linux"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      PLATFORM="windows"
      PLATFORM_NAME="Windows (Git Bash)"
      ;;
    *)
      PLATFORM="unknown"
      PLATFORM_NAME="Unknown"
      ;;
  esac
}

# ---------- Dependency Installation Instructions ----------
show_install_instructions() {
  local dep="$1"
  
  printf "\n"
  printf "    ${BOLD}How to install ${dep}:${NC}\n"
  printf "\n"
  
  case "$dep" in
    docker)
      case "$PLATFORM" in
        macos)
          printf "    ${CYAN}Option 1: Download Docker Desktop${NC}\n"
          printf "      https://www.docker.com/products/docker-desktop\n"
          printf "\n"
          printf "    ${CYAN}Option 2: Install via Homebrew${NC}\n"
          printf "      brew install --cask docker\n"
          ;;
        linux)
          printf "    ${CYAN}Install Docker Engine:${NC}\n"
          printf "      curl -fsSL https://get.docker.com | sudo sh\n"
          printf "      sudo usermod -aG docker \$USER\n"
          printf "      # Log out and back in for group changes to take effect\n"
          ;;
        wsl)
          printf "    ${CYAN}Option 1: Use Docker Desktop for Windows${NC}\n"
          printf "      Install Docker Desktop and enable WSL2 integration in Settings\n"
          printf "      https://www.docker.com/products/docker-desktop\n"
          printf "\n"
          printf "    ${CYAN}Option 2: Install Docker Engine in WSL${NC}\n"
          printf "      curl -fsSL https://get.docker.com | sudo sh\n"
          printf "      sudo usermod -aG docker \$USER\n"
          ;;
        windows)
          printf "    ${CYAN}Install Docker Desktop for Windows:${NC}\n"
          printf "      https://www.docker.com/products/docker-desktop\n"
          printf "\n"
          printf "    ${CYAN}Or via winget:${NC}\n"
          printf "      winget install Docker.DockerDesktop\n"
          ;;
      esac
      ;;
    just)
      case "$PLATFORM" in
        macos)
          printf "    ${CYAN}Install via Homebrew:${NC}\n"
          printf "      brew install just\n"
          ;;
        linux|wsl)
          printf "    ${CYAN}Option 1: Install via script${NC}\n"
          printf "      curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to ~/.local/bin\n"
          printf "      # Add ~/.local/bin to your PATH if not already\n"
          printf "\n"
          printf "    ${CYAN}Option 2: Install via package manager${NC}\n"
          printf "      # Debian/Ubuntu (if available)\n"
          printf "      sudo apt install just\n"
          ;;
        windows)
          printf "    ${CYAN}Option 1: Install via Scoop${NC}\n"
          printf "      scoop install just\n"
          printf "\n"
          printf "    ${CYAN}Option 2: Install via Chocolatey${NC}\n"
          printf "      choco install just\n"
          printf "\n"
          printf "    ${CYAN}Option 3: Download from GitHub${NC}\n"
          printf "      https://github.com/casey/just/releases\n"
          ;;
      esac
      ;;
    curl)
      case "$PLATFORM" in
        macos)
          printf "    curl is pre-installed on macOS.\n"
          printf "    If missing, install via: brew install curl\n"
          ;;
        linux|wsl)
          printf "    ${CYAN}Debian/Ubuntu:${NC}\n"
          printf "      sudo apt-get update && sudo apt-get install -y curl\n"
          printf "\n"
          printf "    ${CYAN}RHEL/CentOS/Fedora:${NC}\n"
          printf "      sudo dnf install curl\n"
          ;;
        windows)
          printf "    curl is included in Windows 10+ and Git Bash.\n"
          printf "    If missing, install via: choco install curl\n"
          ;;
      esac
      ;;
    jq)
      case "$PLATFORM" in
        macos)
          printf "    ${CYAN}Install via Homebrew:${NC}\n"
          printf "      brew install jq\n"
          ;;
        linux|wsl)
          printf "    ${CYAN}Debian/Ubuntu:${NC}\n"
          printf "      sudo apt-get update && sudo apt-get install -y jq\n"
          printf "\n"
          printf "    ${CYAN}RHEL/CentOS/Fedora:${NC}\n"
          printf "      sudo dnf install jq\n"
          ;;
        windows)
          printf "    ${CYAN}Option 1: Install via Scoop${NC}\n"
          printf "      scoop install jq\n"
          printf "\n"
          printf "    ${CYAN}Option 2: Install via Chocolatey${NC}\n"
          printf "      choco install jq\n"
          ;;
      esac
      ;;
    git)
      case "$PLATFORM" in
        macos)
          printf "    ${CYAN}Install via Xcode Command Line Tools:${NC}\n"
          printf "      xcode-select --install\n"
          printf "\n"
          printf "    ${CYAN}Or via Homebrew:${NC}\n"
          printf "      brew install git\n"
          ;;
        linux|wsl)
          printf "    ${CYAN}Debian/Ubuntu:${NC}\n"
          printf "      sudo apt-get update && sudo apt-get install -y git\n"
          printf "\n"
          printf "    ${CYAN}RHEL/CentOS/Fedora:${NC}\n"
          printf "      sudo dnf install git\n"
          ;;
        windows)
          printf "    ${CYAN}Download Git for Windows:${NC}\n"
          printf "      https://git-scm.com/download/win\n"
          printf "\n"
          printf "    ${CYAN}Or via winget:${NC}\n"
          printf "      winget install Git.Git\n"
          ;;
      esac
      ;;
  esac
}

# ---------- Main Script ----------

detect_platform

# Banner
printf "\n"
printf "${BLUE}┌─────────────────────────────────────────────────────────────────┐${NC}\n"
printf "${BLUE}│${NC}                                                                 ${BLUE}│${NC}\n"
printf "${BLUE}│${NC}   ${BOLD}ShipSec Studio Installer${NC}                                      ${BLUE}│${NC}\n"
printf "${BLUE}│${NC}   Self-Hosted Production Deployment                             ${BLUE}│${NC}\n"
printf "${BLUE}│${NC}                                                                 ${BLUE}│${NC}\n"
printf "${BLUE}└─────────────────────────────────────────────────────────────────┘${NC}\n"
printf "\n"
info "Platform: ${BOLD}$PLATFORM_NAME${NC}"
info "Documentation: https://docs.shipsec.ai"
printf "\n"

# ---------- Check Prerequisites ----------
log "Checking prerequisites"
printf "\n"
info "ShipSec Studio requires the following tools:"
info "  - docker    (container runtime)"
info "  - just      (command runner)"
info "  - curl      (HTTP client)"
info "  - jq        (JSON processor)"
info "  - git       (version control)"
printf "\n"

MISSING_DEPS=""
ALL_OK=true

# Check each dependency
for dep in docker just curl jq git; do
  if command_exists "$dep"; then
    case "$dep" in
      docker) ver=$(docker --version 2>/dev/null | sed 's/Docker version //' | cut -d',' -f1) ;;
      just)   ver=$(just --version 2>/dev/null | head -1) ;;
      curl)   ver=$(curl --version 2>/dev/null | head -1 | awk '{print $2}') ;;
      jq)     ver=$(jq --version 2>/dev/null) ;;
      git)    ver=$(git --version 2>/dev/null | sed 's/git version //') ;;
    esac
    printf "    ${GREEN}✓${NC} %-10s %s\n" "$dep" "$ver"
  else
    printf "    ${RED}✗${NC} %-10s ${RED}not found${NC}\n" "$dep"
    MISSING_DEPS="$MISSING_DEPS $dep"
    ALL_OK=false
  fi
done

# If dependencies are missing, show installation instructions
if [ "$ALL_OK" = false ]; then
  MISSING_DEPS="${MISSING_DEPS# }"  # trim leading space
  
  printf "\n"
  err "Missing required dependencies: ${BOLD}$MISSING_DEPS${NC}"
  
  for dep in $MISSING_DEPS; do
    show_install_instructions "$dep"
  done
  
  printf "\n"
  info "After installing the missing dependencies, run this script again:"
  printf "\n"
  printf "    curl -fsSL https://raw.githubusercontent.com/ShipSecAI/studio/main/install.sh | bash\n"
  printf "\n"
  exit 1
fi

printf "\n"
info "${GREEN}All prerequisites are installed!${NC}"

# ---------- Check Docker Daemon ----------
log "Checking Docker daemon"

if ! docker info >/dev/null 2>&1; then
  printf "\n"
  warn "Docker daemon is not running."
  printf "\n"
  
  case "$PLATFORM" in
    macos)
      info "Please start Docker Desktop from your Applications folder."
      printf "\n"
      
      if [ -d "/Applications/Docker.app" ]; then
        if ask_yes_no "Would you like to start Docker Desktop now?" "y"; then
          printf "\n"
          info "Starting Docker Desktop..."
          open -g "/Applications/Docker.app"
          
          printf "    Waiting for Docker to be ready"
          start=$(date +%s)
          while ! docker info >/dev/null 2>&1; do
            now=$(date +%s)
            elapsed=$((now - start))
            if [ "$elapsed" -ge "$WAIT_DOCKER_SEC" ]; then
              printf "\n\n"
              err "Docker did not start within ${WAIT_DOCKER_SEC} seconds."
              err "Please start Docker Desktop manually and run this script again."
              exit 1
            fi
            printf "."
            sleep 2
          done
          printf " ${GREEN}ready!${NC}\n"
        else
          printf "\n"
          info "Please start Docker Desktop and run this script again."
          exit 1
        fi
      else
        err "Docker Desktop not found at /Applications/Docker.app"
        info "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
        exit 1
      fi
      ;;
    linux)
      info "To start Docker, run:"
      printf "\n"
      printf "    sudo systemctl start docker\n"
      printf "\n"
      info "Then run this script again."
      exit 1
      ;;
    wsl)
      info "To use Docker in WSL, you have two options:"
      printf "\n"
      info "  1. Start Docker Desktop for Windows (with WSL2 integration enabled)"
      info "  2. Start the Docker service in WSL: sudo service docker start"
      printf "\n"
      info "Then run this script again."
      exit 1
      ;;
    windows)
      info "Please start Docker Desktop for Windows."
      printf "\n"
      info "Then run this script again."
      exit 1
      ;;
  esac
fi

printf "\n"
info "${GREEN}Docker daemon is running!${NC}"

# ---------- Repository Setup ----------
log "Setting up repository"

IN_REPO=false

# Check if already in the repo
if [ -d .git ] && [ -f justfile ]; then
  IN_REPO=true
  info "Already in ShipSec Studio repository."
# Check if repo exists in current directory
elif [ -d "$REPO_DIR" ] && [ -d "$REPO_DIR/.git" ] && [ -f "$REPO_DIR/justfile" ]; then
  info "Found existing repository in ./$REPO_DIR"
  cd "$REPO_DIR" || { err "Failed to enter directory"; exit 1; }
  IN_REPO=true
fi

if [ "$IN_REPO" = false ]; then
  if [ -d "$REPO_DIR" ]; then
    printf "\n"
    warn "Directory '$REPO_DIR' already exists."
    
    if ask_yes_no "Do you want to use the existing directory?" "y"; then
      cd "$REPO_DIR" || { err "Failed to enter directory"; exit 1; }
    else
      info "Please remove or rename the '$REPO_DIR' directory and run this script again."
      exit 1
    fi
  else
    printf "\n"
    info "Cloning repository from GitHub..."
    printf "\n"
    
    if ! git clone "$REPO_URL" "$REPO_DIR"; then
      err "Failed to clone repository"
      exit 1
    fi
    
    cd "$REPO_DIR" || { err "Failed to enter directory"; exit 1; }
  fi
fi

PROJECT_ROOT="$(pwd)"
printf "\n"
info "Project directory: ${BOLD}$PROJECT_ROOT${NC}"

# ---------- Confirm Installation ----------
log "Ready to install"

printf "\n"
info "This will:"
info "  1. Fetch the latest release version from GitHub"
info "  2. Pull pre-built Docker images from GHCR"
info "  3. Start the full stack (frontend, backend, worker, infrastructure)"
printf "\n"
info "The following services will be available:"
info "  - Frontend:    http://localhost:8090"
info "  - Backend:     http://localhost:3211"
info "  - Temporal UI: http://localhost:8081"
printf "\n"

if ! ask_yes_no "Do you want to proceed with the installation?" "y"; then
  printf "\n"
  info "Installation cancelled."
  printf "\n"
  info "To install later, run:"
  printf "\n"
  printf "    cd %s && just prod start-latest\n" "$PROJECT_ROOT"
  printf "\n"
  exit 0
fi

# ---------- Start Installation ----------
log "Installing ShipSec Studio"

printf "\n"
if ! just prod start-latest; then
  printf "\n"
  err "Installation failed."
  err "Please check the error messages above."
  printf "\n"
  info "For troubleshooting, visit: https://github.com/ShipSecAI/studio/issues"
  exit 1
fi

# ---------- Success ----------
printf "\n"
printf "${GREEN}┌─────────────────────────────────────────────────────────────────┐${NC}\n"
printf "${GREEN}│${NC}                                                                 ${GREEN}│${NC}\n"
printf "${GREEN}│${NC}   ${BOLD}Installation Complete!${NC}                                        ${GREEN}│${NC}\n"
printf "${GREEN}│${NC}                                                                 ${GREEN}│${NC}\n"
printf "${GREEN}│${NC}   Open ShipSec Studio in your browser:                          ${GREEN}│${NC}\n"
printf "${GREEN}│${NC}                                                                 ${GREEN}│${NC}\n"
printf "${GREEN}│${NC}       ${BOLD}http://localhost:8090${NC}                                     ${GREEN}│${NC}\n"
printf "${GREEN}│${NC}                                                                 ${GREEN}│${NC}\n"
printf "${GREEN}└─────────────────────────────────────────────────────────────────┘${NC}\n"
printf "\n"
info "Useful commands:"
printf "\n"
printf "    just prod status   - Check service status\n"
printf "    just prod logs     - View logs\n"
printf "    just prod stop     - Stop all services\n"
printf "    just prod clean    - Remove all data\n"
printf "\n"
info "Documentation: https://docs.shipsec.ai"
info "Need help? https://github.com/ShipSecAI/studio/issues"
printf "\n"

exit 0
