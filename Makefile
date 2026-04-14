.PHONY: format format-write format-check format-api format-frontend install-hooks remove-hooks lint lint-fix lint-api lint-frontend lint-api-fix lint-frontend-fix

NVM_INIT = . ~/.nvm/nvm.sh && nvm use

pre-commit: format-check lint

# Check formatting in all workspaces
format-check: format-api-check format-frontend-check

# Format all code
format: format-api format-frontend

# Format API workspace
format-api:
	cd api && $(NVM_INIT) && yarn format:write

# Check formatting in API
format-api-check:
	cd api && $(NVM_INIT) && yarn format:check

# Format frontend workspace
format-frontend:
	cd frontend && $(NVM_INIT) && yarn format:write

# Check formatting in frontend
format-frontend-check:
	cd frontend && $(NVM_INIT) && yarn format:check

# Lint all workspaces
lint: lint-api lint-frontend

# Lint and auto-fix all workspaces
lint-fix: lint-api-fix lint-frontend-fix

# Lint API workspace
lint-api:
	cd api && $(NVM_INIT) && yarn lint

# Lint and fix API workspace
lint-api-fix:
	cd api && $(NVM_INIT) && yarn lint:fix

# Lint frontend workspace
lint-frontend:
	cd frontend && $(NVM_INIT) && yarn lint

# Lint and fix frontend workspace
lint-frontend-fix:
	cd frontend && $(NVM_INIT) && yarn lint:fix

# Install git hooks
install-hooks:
	@mkdir -p .git/hooks
	@echo '#!/bin/sh' > .git/hooks/pre-commit
	@echo 'make pre-commit' >> .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "Git pre-commit hook installed"

# Remove git hooks
remove-hooks:
	@rm -f .git/hooks/pre-commit
	@echo "Git pre-commit hook removed"
