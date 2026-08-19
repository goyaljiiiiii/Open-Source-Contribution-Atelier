ifeq ($(OS),Windows_NT)
    PYTHON := python
    BIN_DIR := Scripts
else
    PYTHON := python3
    BIN_DIR := bin
endif

VENV_BIN := backend/.venv/$(BIN_DIR)

.PHONY: install start format test verify setup env

setup: env
	@echo "Setup complete! Run 'make install' to set up dependencies or 'make start' for Docker."

env:
	@echo "Setting up environment files from examples..."
	@test -f backend/.env || cp backend/.env.example backend/.env && echo "Created backend/.env" || echo "backend/.env already exists"
	@test -f frontend/.env || cp frontend/.env.example frontend/.env && echo "Created frontend/.env" || echo "frontend/.env already exists"
	@test -f docker-compose.override.yml || cp docker-compose.override.yml.example docker-compose.override.yml && echo "Created docker-compose.override.yml" || echo "docker-compose.override.yml already exists"

install:
	@echo "Installing backend dependencies..."
	$(PYTHON) -m venv backend/.venv
	$(VENV_BIN)/pip install -r backend/requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

start:
	@echo "Starting development stack..."
	docker compose up --build

format:
	@echo "Formatting backend code..."
	$(VENV_BIN)/black backend/ || black backend/
	$(VENV_BIN)/isort backend/ || isort backend/
	@echo "Formatting frontend code..."
	cd frontend && npm run format

test:
	@echo "Running backend tests..."
	$(VENV_BIN)/pytest backend/ || pytest backend/
	@echo "Running frontend tests..."
	cd frontend && npm run test

verify:
	./verify.sh

TOOL_VERSIONS := grype:v0.79.1 pip-audit:2.7.3

.PHONY: scan-vulns install-tools

install-tools:
	@echo "Installing vulnerability scanning tools (pinned versions)..."
	pip install pip-audit==2.7.3
	@echo "To install Grype: curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin v0.79.1"

scan-vulns: install-tools
	@echo "=== pip-audit (Python) ==="
	pip-audit --require-hashes --strict -r backend/requirements.txt || true
	@echo ""
	@echo "=== npm audit (Frontend) ==="
	cd frontend && npm audit --audit-level=high || true
	@echo ""
	@echo "=== Grype (Docker image) ==="
	grype open-contribution-atelier-backend:latest --fail-on HIGH --only-fixed || true
	@echo ""
	@echo "=== Allowlist Check ==="
	python backend/scripts/check_dependency_allowlist.py \
		--reports-dir . \
		--allowlist backend/scripts/vuln-allowlist.json \
		--output vuln-report-consolidated.json
	@echo "=== Done ==="
