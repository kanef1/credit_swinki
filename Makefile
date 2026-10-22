.PHONY: help up down restart logs status dev-backend dev-frontend db-up test test-backend test-e2e lint swagger seed clean

# Цвета для красивого вывода
CYAN    := \033[36m
GREEN   := \033[32m
YELLOW  := \033[33m
RED     := \033[31m
RESET   := \033[0m

help: ## Показать справку по доступным командам
	@echo "$(CYAN)Альфа Хак — Умный кредитный кабинет предпринимателя$(RESET)"
	@echo "$(YELLOW)Доступные команды:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2}'

# ==========================================
# Docker & Развертывание
# ==========================================

up: ## Собрать и запустить все сервисы (БД + Бэкенд + Фронтенд) в Docker
	@echo "$(CYAN)Запуск всех сервисов в Docker...$(RESET)"
	docker compose up --build -d
	@echo "$(GREEN)Готово!$(RESET)"
	@echo "  Веб-интерфейс:     $(CYAN)http://localhost:3000$(RESET)"
	@echo "  API & Swagger:     $(CYAN)http://localhost:8080/swagger/index.html$(RESET)"
	@echo "  Метрики / Health:  $(CYAN)http://localhost:8080/api/v1/health$(RESET)"

down: ## Остановить и удалить все контейнеры
	@echo "$(YELLOW)Остановка сервисов...$(RESET)"
	docker compose down

restart: down up ## Перезапуск окружения

logs: ## Просмотр логов всех сервисов в реальном времени
	docker compose logs -f

status: ## Проверить статус контейнеров и доступность сервисов
	docker compose ps
	@echo "\n$(CYAN)Проверка бэкенда...$(RESET)"
	@curl -s http://localhost:8080/api/v1/health || echo "$(RED)Backend недоступен$(RESET)"

# ==========================================
# Локальная разработка (без полного Docker)
# ==========================================

db-up: ## Запустить только PostgreSQL в Docker для локальной разработки
	docker compose up -d postgres

dev-backend: ## Запустить Go-бэкенд локально (порт 8080)
	@echo "$(CYAN)Запуск Go бэкенда локально...$(RESET)"
	cd backend && go run cmd/server/main.go

dev-frontend: ## Запустить React/Vite фронтенд локально (порт 3000)
	@echo "$(CYAN)Запуск Vite фронтенда локально...$(RESET)"
	cd frontend && npm run dev

# ==========================================
# Тестирование и проверка качества
# ==========================================

test: test-backend test-e2e ## Запуск всех тестов (Unit + E2E)

test-backend: ## Запуск Unit-тестов Go (скоринг, FSM, валидация)
	@echo "$(CYAN)Запуск Unit-тестов бэкенда...$(RESET)"
	cd backend && go test -v -race ./...

test-e2e: ## Запуск сквозного сценария проверки 4 кейсов через API
	@echo "$(CYAN)Запуск E2E сценария проверки...$(RESET)"
	cd backend && go test -v -run TestE2EScenarios ./tests/...

lint: ## Проверка линтерами (Go)
	@echo "$(CYAN)Запуск линтеров...$(RESET)"
	cd backend && golangci-lint run ./... || go vet ./...

swagger: ## Перегенерация OpenAPI / Swagger документации
	@echo "$(CYAN)Генерация Swagger документации...$(RESET)"
	cd backend && swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal

seed: ## Накатить тестовые синтетические данные
	@echo "$(CYAN)Накатывание синтетических данных...$(RESET)"
	curl -X POST http://localhost:8080/api/v1/demo/seed || echo "$(RED)Бэкенд должен быть запущен$(RESET)"

clean: ## Очистка бинарников, временных файлов и томов
	@echo "$(YELLOW)Очистка временных файлов...$(RESET)"
	rm -rf backend/bin frontend/dist
	docker compose down -v
