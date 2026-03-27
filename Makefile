.PHONY: format format-write format-check format-api format-frontend install-hooks remove-hooks

NVM_INIT = . ~/.nvm/nvm.sh && nvm use

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

# Install git hooks
install-hooks:
	@mkdir -p .git/hooks
	@echo '#!/bin/sh' > .git/hooks/pre-commit
	@echo 'make format-check' >> .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "Git pre-commit hook installed"

# Remove git hooks
remove-hooks:
	@rm -f .git/hooks/pre-commit
	@echo "Git pre-commit hook removed"
