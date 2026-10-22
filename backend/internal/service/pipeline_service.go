package service

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/kanef1/credit_swinki/backend/internal/domain"
	"github.com/kanef1/credit_swinki/backend/internal/repository"
)

// PipelineService управляет жизненным циклом кредитной заявки на конвейере
type PipelineService struct {
	repo       *repository.Repository
	enrichment *EnrichmentService
	scoring    *ScoringService
}

func NewPipelineService(repo *repository.Repository, enrichment *EnrichmentService, scoring *ScoringService) *PipelineService {
	return &PipelineService{
		repo:       repo,
		enrichment: enrichment,
		scoring:    scoring,
	}
}

// CreateApplicationDTO входные данные для создания заявки
type CreateApplicationDTO struct {
	INN                 string  `json:"inn" binding:"required"`
	ProductID           string  `json:"product_id" binding:"required"`
	RequestedAmount     float64 `json:"requested_amount" binding:"required,gt=0"`
	RequestedTermMonths int     `json:"requested_term_months" binding:"required,gt=0"`
	FinancingGoal       string  `json:"financing_goal"`
	RepaymentType       string  `json:"repayment_type"`
}

// CreateApplication регистрирует новую заявку в статусе DRAFT и автоматически обогащает компанию
func (s *PipelineService) CreateApplication(dto CreateApplicationDTO) (*domain.Application, error) {
	// 1. Поиск или создание компании через сервис обогащения
	compData, err := s.enrichment.GetCompanyByINN(dto.INN)
	if err != nil {
		return nil, err
	}

	// Сохраняем или обновляем компанию в БД
	var existingCompany domain.Company
	res := s.repo.DB.Where("inn = ?", compData.INN).First(&existingCompany)
	if res.Error != nil {
		if err := s.repo.DB.Create(&compData).Error; err != nil {
			return nil, fmt.Errorf("ошибка сохранения компании: %w", err)
		}
		existingCompany = compData
	} else {
		// Обновляем свежими данными
		compData.ID = existingCompany.ID
		s.repo.DB.Save(&compData)
		existingCompany = compData
	}

	// 2. Проверяем продукт
	var product domain.CreditProduct
	if err := s.repo.DB.Where("id = ?", dto.ProductID).First(&product).Error; err != nil {
		return nil, fmt.Errorf("кредитный продукт '%s' не найден", dto.ProductID)
	}

	// 3. Формируем номер заявки
	now := time.Now()
	appNumber := fmt.Sprintf("ALFA-%d-%04d", now.Year(), rand.Intn(9000)+1000)

	repaymentType := "ANNUITY"
	if dto.RepaymentType != "" {
		repaymentType = dto.RepaymentType
	}

	app := &domain.Application{
		ID:                  uuid.New(),
		ApplicationNumber:   appNumber,
		CompanyID:           existingCompany.ID,
		ProductID:           product.ID,
		RequestedAmount:     dto.RequestedAmount,
		RequestedTermMonths: dto.RequestedTermMonths,
		FinancingGoal:       dto.FinancingGoal,
		RepaymentType:       repaymentType,
		Status:              domain.StatusDraft,
		SMSCode:             fmt.Sprintf("%04d", rand.Intn(9000)+1000), // Демо-код для in-app подтверждения
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	if err := s.repo.DB.Create(app).Error; err != nil {
		return nil, fmt.Errorf("ошибка создания заявки: %w", err)
	}

	s.repo.LogTransition(app.ID, "", domain.StatusDraft, "CLIENT", "Заявка инициализирована в личном кабинете")

	return s.GetApplicationByID(app.ID)
}

// ProcessPipeline проводит заявку по этапам конвейера: SUBMITTED -> ENRICHING -> SCORING -> DECISION
func (s *PipelineService) ProcessPipeline(appID uuid.UUID) (*domain.Application, error) {
	app, err := s.GetApplicationByID(appID)
	if err != nil {
		return nil, err
	}

	// Валидация перехода DRAFT -> SUBMITTED
	if app.Status == domain.StatusDraft {
		if err := domain.ValidateTransition(app.Status, domain.StatusSubmitted); err != nil {
			return nil, err
		}
		app.Status = domain.StatusSubmitted
		s.repo.DB.Save(app)
		s.repo.LogTransition(app.ID, domain.StatusDraft, domain.StatusSubmitted, "CLIENT", "Клиент отправил заявку на рассмотрение")
	}

	// Переход SUBMITTED -> ENRICHING
	if app.Status == domain.StatusSubmitted {
		if err := domain.ValidateTransition(app.Status, domain.StatusEnriching); err != nil {
			return nil, err
		}
		app.Status = domain.StatusEnriching
		s.repo.DB.Save(app)
		s.repo.LogTransition(app.ID, domain.StatusSubmitted, domain.StatusEnriching, "SYSTEM", "Запущен процесс сбора данных ФНС, ЕГРЮЛ и БКИ")

		// Обогащаем компанию свежими данными
		freshCompany, err := s.enrichment.GetCompanyByINN(app.Company.INN)
		if err == nil {
			freshCompany.ID = app.Company.ID
			s.repo.DB.Save(&freshCompany)
			app.Company = &freshCompany
		}
	}

	// Переход ENRICHING -> SCORING
	if app.Status == domain.StatusEnriching {
		if err := domain.ValidateTransition(app.Status, domain.StatusScoring); err != nil {
			return nil, err
		}
		app.Status = domain.StatusScoring
		s.repo.DB.Save(app)
		s.repo.LogTransition(app.ID, domain.StatusEnriching, domain.StatusScoring, "SYSTEM", "Расчет финансовой риск-модели и проверка стоп-факторов")
	}

	// Выполняем оценку риск-моделью
	scoringRes := s.scoring.Evaluate(app.Company, app.Product, app.RequestedAmount, app.RequestedTermMonths)
	scoringRes.ApplicationID = app.ID

	// Сохраняем результат скоринга
	s.repo.DB.Where("application_id = ?", app.ID).Delete(&domain.ScoringResult{})
	s.repo.DB.Create(&scoringRes)

	// Принятие решения конвейером
	switch scoringRes.RecommendedDecision {
	case "APPROVE":
		app.Status = domain.StatusOfferReady
		app.ApprovedAmount = app.RequestedAmount
		app.ApprovedTermMonths = app.RequestedTermMonths
		app.ApprovedRate = scoringRes.RecommendedRate
		app.MonthlyPayment = s.scoring.CalculateMonthlyPayment(app.ApprovedAmount, app.ApprovedRate, app.ApprovedTermMonths)
		app.IsCounterOffer = false
		s.repo.LogTransition(app.ID, domain.StatusScoring, domain.StatusOfferReady, "SYSTEM", fmt.Sprintf("Заявка одобрена на запрошенных условиях: %.0f ₽ под %.1f%%", app.ApprovedAmount, app.ApprovedRate))

	case "COUNTER_OFFER":
		app.Status = domain.StatusOfferReady
		app.ApprovedAmount = scoringRes.MaxApprovedAmount
		app.ApprovedTermMonths = app.RequestedTermMonths
		app.ApprovedRate = scoringRes.RecommendedRate
		app.MonthlyPayment = s.scoring.CalculateMonthlyPayment(app.ApprovedAmount, app.ApprovedRate, app.ApprovedTermMonths)
		app.IsCounterOffer = true
		app.CounterOfferReason = fmt.Sprintf("Для сохранения комфортной долговой нагрузки компании сумма скорректирована до %.0f ₽. Рекомендуем также увеличить срок финансирования.", app.ApprovedAmount)
		s.repo.LogTransition(app.ID, domain.StatusScoring, domain.StatusOfferReady, "SYSTEM", fmt.Sprintf("Сформировано встречное предложение (Counter-offer): лимит скорректирован до %.0f ₽", app.ApprovedAmount))

	case "MANUAL_REVIEW":
		app.Status = domain.StatusManualReview
		s.repo.LogTransition(app.ID, domain.StatusScoring, domain.StatusManualReview, "SYSTEM", "Заявка направлена на рассмотрение кредитному андеррайтеру (пограничный скор / налоговые или судебные вопросы)")

	case "REJECT":
		app.Status = domain.StatusRejected
		rejectionMsg := "Заявка не прошла критерии одобрения кредитной политики"
		if len(scoringRes.StopFactors) > 0 {
			rejectionMsg = scoringRes.StopFactors[0]
		}
		app.RejectionReason = rejectionMsg
		s.repo.LogTransition(app.ID, domain.StatusScoring, domain.StatusRejected, "SYSTEM", fmt.Sprintf("Отказ конвейера: %s", rejectionMsg))
	}

	app.UpdatedAt = time.Now()
	s.repo.DB.Save(app)

	return s.GetApplicationByID(app.ID)
}

// UnderwriterApproveDTO параметры ручного решения андеррайтера
type UnderwriterApproveDTO struct {
	ApprovedAmount     float64 `json:"approved_amount" binding:"required,gt=0"`
	ApprovedTermMonths int     `json:"approved_term_months" binding:"required,gt=0"`
	ApprovedRate       float64 `json:"approved_rate" binding:"required,gt=0"`
	Notes              string  `json:"notes"`
}

// UnderwriterApprove подтверждает заявку андеррайтером
func (s *PipelineService) UnderwriterApprove(appID uuid.UUID, dto UnderwriterApproveDTO) (*domain.Application, error) {
	app, err := s.GetApplicationByID(appID)
	if err != nil {
		return nil, err
	}

	if app.Status != domain.StatusManualReview {
		return nil, fmt.Errorf("заявка находится в статусе '%s', ручное согласование доступно только для '%s'", app.Status, domain.StatusManualReview)
	}

	app.Status = domain.StatusOfferReady
	app.ApprovedAmount = dto.ApprovedAmount
	app.ApprovedTermMonths = dto.ApprovedTermMonths
	app.ApprovedRate = dto.ApprovedRate
	app.MonthlyPayment = s.scoring.CalculateMonthlyPayment(dto.ApprovedAmount, dto.ApprovedRate, dto.ApprovedTermMonths)
	app.UnderwriterNotes = dto.Notes
	app.IsCounterOffer = dto.ApprovedAmount != app.RequestedAmount
	app.UpdatedAt = time.Now()

	s.repo.DB.Save(app)
	s.repo.LogTransition(app.ID, domain.StatusManualReview, domain.StatusOfferReady, "UNDERWRITER", fmt.Sprintf("Одобрено андеррайтером: %.0f ₽, %.1f%% годовых. Комментарий: %s", dto.ApprovedAmount, dto.ApprovedRate, dto.Notes))

	return s.GetApplicationByID(app.ID)
}

// UnderwriterReject отклоняет заявку андеррайтером
func (s *PipelineService) UnderwriterReject(appID uuid.UUID, reason string) (*domain.Application, error) {
	app, err := s.GetApplicationByID(appID)
	if err != nil {
		return nil, err
	}

	if app.Status != domain.StatusManualReview {
		return nil, fmt.Errorf("заявка находится в статусе '%s', ручное отклонение доступно только для '%s'", app.Status, domain.StatusManualReview)
	}

	app.Status = domain.StatusRejected
	app.RejectionReason = reason
	app.UpdatedAt = time.Now()

	s.repo.DB.Save(app)
	s.repo.LogTransition(app.ID, domain.StatusManualReview, domain.StatusRejected, "UNDERWRITER", fmt.Sprintf("Отклонено андеррайтером. Причина: %s", reason))

	return s.GetApplicationByID(app.ID)
}

// SignAndDisburse принимает предложение, симулирует ПЭП СМС-подпись и выдает средства
func (s *PipelineService) SignAndDisburse(appID uuid.UUID, smsCode string) (*domain.Application, error) {
	app, err := s.GetApplicationByID(appID)
	if err != nil {
		return nil, err
	}

	if app.Status != domain.StatusOfferReady {
		return nil, fmt.Errorf("подписание возможно только для предложений в статусе '%s' (текущий: '%s')", domain.StatusOfferReady, app.Status)
	}

	// Проверка демо СМС-кода (или универсального '0000')
	if smsCode != app.SMSCode && smsCode != "0000" {
		return nil, fmt.Errorf("неверный СМС-код подтверждения")
	}

	now := time.Now()
	// 1. Подписание договора
	app.Status = domain.StatusSigned
	app.SignedAt = &now
	s.repo.DB.Save(app)
	s.repo.LogTransition(app.ID, domain.StatusOfferReady, domain.StatusSigned, "CLIENT", "Кредитный договор успешно подписан простой электронной подписью (ПЭП)")

	// 2. Моделированная выдача денежных средств
	disbursedTime := now.Add(2 * time.Second)
	app.Status = domain.StatusDisbursed
	app.DisbursedAt = &disbursedTime
	s.repo.DB.Save(app)
	s.repo.LogTransition(app.ID, domain.StatusSigned, domain.StatusDisbursed, "SYSTEM", fmt.Sprintf("Денежные средства в размере %.0f ₽ успешно зачислены на расчетный счет компании", app.ApprovedAmount))

	return s.GetApplicationByID(app.ID)
}

// GetApplicationByID загружает полную заявку со всеми связями
func (s *PipelineService) GetApplicationByID(id uuid.UUID) (*domain.Application, error) {
	var app domain.Application
	err := s.repo.DB.
		Preload("Company").
		Preload("Product").
		Preload("ScoringResult").
		Preload("AuditLogs").
		Preload("Documents").
		Where("id = ?", id).
		First(&app).Error
	if err != nil {
		return nil, fmt.Errorf("заявка '%s' не найдена", id)
	}
	return &app, nil
}

// ListApplications возвращает список заявок с возможностью фильтрации по статусу
func (s *PipelineService) ListApplications(status string) ([]domain.Application, error) {
	var apps []domain.Application
	query := s.repo.DB.Preload("Company").Preload("Product").Order("created_at desc")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Find(&apps).Error; err != nil {
		return nil, err
	}
	return apps, nil
}

// PipelineStats агрегированные метрики работы конвейера для дашборда андеррайтера
type PipelineStats struct {
	TotalApplications    int64   `json:"total_applications"`
	DraftCount           int64   `json:"draft_count"`
	ReviewCount          int64   `json:"review_count"`
	ApprovedCount        int64   `json:"approved_count"`
	DisbursedCount       int64   `json:"disbursed_count"`
	RejectedCount        int64   `json:"rejected_count"`
	TotalDisbursedVolume float64 `json:"total_disbursed_volume"`
	AverageScore         float64 `json:"average_score"`
}

// GetStats рассчитывает аналитику по конвейеру
func (s *PipelineService) GetStats() (PipelineStats, error) {
	var stats PipelineStats

	s.repo.DB.Model(&domain.Application{}).Count(&stats.TotalApplications)
	s.repo.DB.Model(&domain.Application{}).Where("status = ?", domain.StatusDraft).Count(&stats.DraftCount)
	s.repo.DB.Model(&domain.Application{}).Where("status = ?", domain.StatusManualReview).Count(&stats.ReviewCount)
	s.repo.DB.Model(&domain.Application{}).Where("status IN ?", []domain.ApplicationStatus{domain.StatusOfferReady, domain.StatusSigned}).Count(&stats.ApprovedCount)
	s.repo.DB.Model(&domain.Application{}).Where("status = ?", domain.StatusDisbursed).Count(&stats.DisbursedCount)
	s.repo.DB.Model(&domain.Application{}).Where("status = ?", domain.StatusRejected).Count(&stats.RejectedCount)

	type SumResult struct {
		Total float64
	}
	var sumRes SumResult
	s.repo.DB.Model(&domain.Application{}).Where("status = ?", domain.StatusDisbursed).Select("COALESCE(SUM(approved_amount), 0) as total").Scan(&sumRes)
	stats.TotalDisbursedVolume = sumRes.Total

	type AvgScoreResult struct {
		Avg float64
	}
	var avgRes AvgScoreResult
	s.repo.DB.Model(&domain.ScoringResult{}).Select("COALESCE(AVG(total_score), 0) as avg").Scan(&avgRes)
	stats.AverageScore = avgRes.Avg

	return stats, nil
}

// ListProducts возвращает список доступных продуктов
func (s *PipelineService) ListProducts() ([]domain.CreditProduct, error) {
	var products []domain.CreditProduct
	if err := s.repo.DB.Where("is_active = ?", true).Find(&products).Error; err != nil {
		return nil, err
	}
	return products, nil
}
