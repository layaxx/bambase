.PHONY: format format-write format-check install-hooks remove-hooks lint lint-fix

NVM_INIT = . ~/.nvm/nvm.sh && nvm use

pre-commit: format-check lint

# Check formatting
format-check:
	cd frontend && $(NVM_INIT) && yarn format:check

# Format all code
format:
	cd frontend && $(NVM_INIT) && yarn format:write

# Lint
lint:
	cd frontend && $(NVM_INIT) && yarn lint

# Lint and auto-fix
lint-fix:
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
