package tests

import (
	"os"
	"testing"

	"github.com/kanef1/credit_swinki/backend/internal/domain"
	"github.com/kanef1/credit_swinki/backend/internal/repository"
	"github.com/kanef1/credit_swinki/backend/internal/service"
)

func setupTestPipeline(t *testing.T) (*service.PipelineService, func()) {
	// Используем временный файл SQLite для тестов
	testDB := "test_pipeline.db"
	_ = os.Remove(testDB)
	_ = os.Setenv("DATABASE_URL", "")

	repo, err := repository.InitDB()
	if err != nil {
		t.Fatalf("Ошибка инициализации тестовой БД: %v", err)
	}

	enrichment := service.NewEnrichmentService()
	scoring := service.NewScoringService()
	pipeline := service.NewPipelineService(repo, enrichment, scoring)

	cleanup := func() {
		_ = os.Remove(testDB)
		_ = os.Remove("credit_swinki.db")
	}

	return pipeline, cleanup
}

func TestE2EScenarios(t *testing.T) {
	pipeline, cleanup := setupTestPipeline(t)
	defer cleanup()

	// 1. Тестируем полный путь сценария №1 (Автоодобрение -> Подписание ПЭП -> Выдача)
	t.Run("E2E Auto-Approve Flow (Scenario 1)", func(t *testing.T) {
		app, err := pipeline.CreateApplication(service.CreateApplicationDTO{
			INN:                 "7701234567",
			ProductID:           "working-capital",
			RequestedAmount:     5_000_000,
			RequestedTermMonths: 24,
			FinancingGoal:       "Пополнение оборотных средств",
		})
		if err != nil {
			t.Fatalf("CreateApplication failed: %v", err)
		}
		if app.Status != domain.StatusDraft {
			t.Errorf("Ожидался статус DRAFT, получен: %s", app.Status)
		}

		// Запуск конвейера
		processedApp, err := pipeline.ProcessPipeline(app.ID)
		if err != nil {
			t.Fatalf("ProcessPipeline failed: %v", err)
		}
		if processedApp.Status != domain.StatusOfferReady {
			t.Errorf("Ожидался статус OFFER_READY, получен: %s", processedApp.Status)
		}
		if processedApp.ApprovedAmount != 5_000_000 {
			t.Errorf("Ожидалось одобрение на 5 млн, получено: %.0f", processedApp.ApprovedAmount)
		}

		// Подписание договора in-app кодом
		smsCode := processedApp.SMSCode
		signedApp, err := pipeline.SignAndDisburse(app.ID, smsCode)
		if err != nil {
			t.Fatalf("SignAndDisburse failed: %v", err)
		}
		if signedApp.Status != domain.StatusDisbursed {
			t.Errorf("Ожидался статус DISBURSED после подписания, получен: %s", signedApp.Status)
		}
		if signedApp.DisbursedAt == nil {
			t.Errorf("DisbursedAt не должен быть nil")
		}
	})

	// 2. Тестируем путь сценария №3 (Ручной андеррайтинг: Эскалация -> Одобрение сотрудником банка)
	t.Run("E2E Underwriter Flow (Scenario 3)", func(t *testing.T) {
		app, err := pipeline.CreateApplication(service.CreateApplicationDTO{
			INN:                 "5001122334",
			ProductID:           "equipment-investment",
			RequestedAmount:     4_000_000,
			RequestedTermMonths: 36,
			FinancingGoal:       "Покупка оборудования",
		})
		if err != nil {
			t.Fatalf("CreateApplication failed: %v", err)
		}

		processedApp, err := pipeline.ProcessPipeline(app.ID)
		if err != nil {
			t.Fatalf("ProcessPipeline failed: %v", err)
		}
		if processedApp.Status != domain.StatusManualReview {
			t.Errorf("Ожидался статус MANUAL_REVIEW, получен: %s", processedApp.Status)
		}

		// Андеррайтер рассматривает и одобряет с лимитом 3.5 млн под 15.0%
		reviewedApp, err := pipeline.UnderwriterApprove(app.ID, service.UnderwriterApproveDTO{
			ApprovedAmount:     3_500_000,
			ApprovedTermMonths: 36,
			ApprovedRate:       15.0,
			Notes:              "Сверка с ФНС пройдена успешно, скорректирован лимит",
		})
		if err != nil {
			t.Fatalf("UnderwriterApprove failed: %v", err)
		}
		if reviewedApp.Status != domain.StatusOfferReady {
			t.Errorf("Ожидался статус OFFER_READY после андеррайтера, получен: %s", reviewedApp.Status)
		}
		if reviewedApp.ApprovedAmount != 3_500_000 {
			t.Errorf("Ожидалось одобрение 3.5 млн, получено: %.0f", reviewedApp.ApprovedAmount)
		}
	})
}
