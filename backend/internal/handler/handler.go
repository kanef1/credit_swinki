package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kanef1/credit_swinki/backend/internal/service"
)

// Handler обрабатывает входящие HTTP-запросы
type Handler struct {
	pipeline   *service.PipelineService
	enrichment *service.EnrichmentService
}

func NewHandler(pipeline *service.PipelineService, enrichment *service.EnrichmentService) *Handler {
	return &Handler{
		pipeline:   pipeline,
		enrichment: enrichment,
	}
}

// HealthCheck godoc
// @Summary Проверка работоспособности сервиса
// @Tags System
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/health [get]
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "UP",
		"service": "Alfa Credit Conveyor API",
		"time":    time.Now().Format(time.RFC3339),
	})
}

// GetProducts godoc
// @Summary Получить список кредитных продуктов Альфа-Банка
// @Tags Products
// @Produce json
// @Success 200 {array} domain.CreditProduct
// @Router /api/v1/products [get]
func (h *Handler) GetProducts(c *gin.Context) {
	products, err := h.pipeline.ListProducts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, products)
}

// GetDemoCompanies godoc
// @Summary Получить эталонные синтетические компании для проверки сценариев жюри
// @Tags Demo
// @Produce json
// @Success 200 {array} domain.Company
// @Router /api/v1/demo/companies [get]
func (h *Handler) GetDemoCompanies(c *gin.Context) {
	companies := h.enrichment.GetAllSyntheticCompanies()
	c.JSON(http.StatusOK, companies)
}

// SeedDemoData godoc
// @Summary Сбросить и наполнить базу эталонными заявками
// @Tags Demo
// @Produce json
// @Success 200 {object} map[string]string
// @Router /api/v1/demo/seed [post]
func (h *Handler) SeedDemoData(c *gin.Context) {
	// Создаем по одной заявке на каждый из 4 эталонных сценариев
	scenarios := []struct {
		INN      string
		Product  string
		Amount   float64
		Term     int
		Goal     string
		AutoExec bool
	}{
		{"7701234567", "working-capital", 5_000_000, 24, "Пополнение оборотных средств", true},
		{"7809876543", "working-capital", 6_000_000, 12, "Закупка товарных запасов", true},
		{"5001122334", "equipment-investment", 4_000_000, 36, "Покупка станка ЧПУ", true},
		{"9705544332", "working-capital", 3_000_000, 18, "Оборотные средства", true},
	}

	for _, sc := range scenarios {
		app, err := h.pipeline.CreateApplication(service.CreateApplicationDTO{
			INN:                 sc.INN,
			ProductID:           sc.Product,
			RequestedAmount:     sc.Amount,
			RequestedTermMonths: sc.Term,
			FinancingGoal:       sc.Goal,
		})
		if err == nil && sc.AutoExec {
			_, _ = h.pipeline.ProcessPipeline(app.ID)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Синтетические данные успешно сгенерированы"})
}

// LookupCompany godoc
// @Summary Поиск и обогащение сведений о компании по ИНН (ФНС / ЕГРЮЛ / БКИ)
// @Tags Companies
// @Param inn query string true "ИНН компании (10 цифр) или ИП (12 цифр)"
// @Produce json
// @Success 200 {object} domain.Company
// @Router /api/v1/companies/lookup [get]
func (h *Handler) LookupCompany(c *gin.Context) {
	inn := c.Query("inn")
	if inn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Параметр 'inn' обязателен"})
		return
	}

	comp, err := h.enrichment.GetCompanyByINN(inn)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, comp)
}

// CreateApplication godoc
// @Summary Создать черновик кредитной заявки
// @Tags Applications
// @Accept json
// @Produce json
// @Param request body service.CreateApplicationDTO true "Данные заявки"
// @Success 201 {object} domain.Application
// @Router /api/v1/applications [post]
func (h *Handler) CreateApplication(c *gin.Context) {
	var dto service.CreateApplicationDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные параметры запроса: " + err.Error()})
		return
	}

	app, err := h.pipeline.CreateApplication(dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, app)
}

// SubmitApplication godoc
// @Summary Отправить заявку в конвейер (запуск обогащения и скоринга)
// @Tags Applications
// @Param id path string true "ID заявки (UUID)"
// @Produce json
// @Success 200 {object} domain.Application
// @Router /api/v1/applications/{id}/submit [post]
func (h *Handler) SubmitApplication(c *gin.Context) {
	idStr := c.Param("id")
	appID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный UUID заявки"})
		return
	}

	app, err := h.pipeline.ProcessPipeline(appID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

// GetApplication godoc
// @Summary Получить статус и детали кредитной заявки
// @Tags Applications
// @Param id path string true "ID заявки (UUID)"
// @Produce json
// @Success 200 {object} domain.Application
// @Router /api/v1/applications/{id} [get]
func (h *Handler) GetApplication(c *gin.Context) {
	idStr := c.Param("id")
	appID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный UUID заявки"})
		return
	}

	app, err := h.pipeline.GetApplicationByID(appID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

// ListApplications godoc
// @Summary Список всех заявок (для андеррайтера или истории клиента)
// @Tags Applications
// @Param status query string false "Фильтр по статусу (например, MANUAL_REVIEW, OFFER_READY)"
// @Produce json
// @Success 200 {array} domain.Application
// @Router /api/v1/applications [get]
func (h *Handler) ListApplications(c *gin.Context) {
	status := c.Query("status")
	apps, err := h.pipeline.ListApplications(status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, apps)
}

// SignOfferDTO запрос на подписание договора
type SignOfferDTO struct {
	SMSCode string `json:"sms_code" binding:"required"`
}

// SignOffer godoc
// @Summary Принять условия и подписать кредитный договор (ПЭП СМС)
// @Tags Applications
// @Param id path string true "ID заявки"
// @Param request body SignOfferDTO true "СМС-код подтверждения"
// @Produce json
// @Success 200 {object} domain.Application
// @Router /api/v1/applications/{id}/sign [post]
func (h *Handler) SignOffer(c *gin.Context) {
	idStr := c.Param("id")
	appID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный UUID заявки"})
		return
	}

	var dto SignOfferDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Код СМС обязателен"})
		return
	}

	app, err := h.pipeline.SignAndDisburse(appID, dto.SMSCode)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

// UnderwriterApprove godoc
// @Summary Ручное одобрение заявки андеррайтером
// @Tags Underwriter
// @Param id path string true "ID заявки"
// @Param request body service.UnderwriterApproveDTO true "Параметры согласования"
// @Produce json
// @Success 200 {object} domain.Application
// @Router /api/v1/underwriter/applications/{id}/approve [post]
func (h *Handler) UnderwriterApprove(c *gin.Context) {
	idStr := c.Param("id")
	appID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный UUID"})
		return
	}

	var dto service.UnderwriterApproveDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	app, err := h.pipeline.UnderwriterApprove(appID, dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

// UnderwriterRejectDTO запрос на ручное отклонение
type UnderwriterRejectDTO struct {
	Reason string `json:"reason" binding:"required"`
}

// UnderwriterReject godoc
// @Summary Отклонение заявки андеррайтером с указанием причины
// @Tags Underwriter
// @Param id path string true "ID заявки"
// @Param request body UnderwriterRejectDTO true "Причина отказа"
// @Produce json
// @Success 200 {object} domain.Application
// @Router /api/v1/underwriter/applications/{id}/reject [post]
func (h *Handler) UnderwriterReject(c *gin.Context) {
	idStr := c.Param("id")
	appID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный UUID"})
		return
	}

	var dto UnderwriterRejectDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	app, err := h.pipeline.UnderwriterReject(appID, dto.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

// GetStats godoc
// @Summary Метрики конвейера для дашборда банка
// @Tags Underwriter
// @Produce json
// @Success 200 {object} service.PipelineStats
// @Router /api/v1/underwriter/stats [get]
func (h *Handler) GetStats(c *gin.Context) {
	stats, err := h.pipeline.GetStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}
