package service

import (
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/kanef1/credit_swinki/backend/internal/domain"
)

// ScoringService отвечает за расчет риск-балла, формирование факторов и принятие кредитного решения
type ScoringService struct{}

func NewScoringService() *ScoringService {
	return &ScoringService{}
}

// CalculateMonthlyPayment вычисляет аннуитетный платеж по формуле финансовой математики
func (s *ScoringService) CalculateMonthlyPayment(amount float64, rateAnnual float64, termMonths int) float64 {
	if termMonths <= 0 || amount <= 0 {
		return 0
	}
	monthlyRate := rateAnnual / 12.0 / 100.0
	if monthlyRate == 0 {
		return amount / float64(termMonths)
	}
	factor := math.Pow(1.0+monthlyRate, float64(termMonths))
	payment := amount * (monthlyRate * factor) / (factor - 1.0)
	return math.Round(payment)
}

// Evaluate выполняет скоринг заемщика и формирует кредитное решение
func (s *ScoringService) Evaluate(company *domain.Company, product *domain.CreditProduct, requestedAmount float64, requestedTermMonths int) domain.ScoringResult {
	now := time.Now()
	businessAgeMonths := int(now.Sub(company.RegistrationDate).Hours() / 24 / 30)

	var stopFactors []string
	var recommendations []string
	var factors []domain.ScoringFactor

	baseScore := 400 // Начальный базовый скоринг

	// 1. Проверка Стоп-факторов
	if businessAgeMonths < 6 {
		stopFactors = append(stopFactors, "Срок ведения деятельности компании составляет менее 6 месяцев")
		recommendations = append(recommendations, "Повторно подать заявку после достижения компанией возраста не менее 6 месяцев (рекомендуется от 12 месяцев).")
	}

	if company.NetProfit <= 0 {
		stopFactors = append(stopFactors, "Отрицательный финансовый результат (чистый убыток по итогам отчетного периода)")
		recommendations = append(recommendations, "Улучшить операционную рентабельность бизнеса и оптимизировать расходы.")
	}

	if company.HasTaxArrears && company.TaxArrearsAmount > 300_000 {
		stopFactors = append(stopFactors, fmt.Sprintf("Критическая задолженность перед ФНС: %.0f ₽", company.TaxArrearsAmount))
		recommendations = append(recommendations, "Погасить имеющуюся задолженность перед бюджетом и предоставить справку об отсутствии долга.")
	}

	if company.BkiScore < 500 {
		stopFactors = append(stopFactors, fmt.Sprintf("Критически низкий скоринг в БКИ (%d/850), наличие дефолтов/длительных просрочек", company.BkiScore))
		recommendations = append(recommendations, "Регулярно и своевременно обслуживать текущие обязательства без просрочек не менее 6 месяцев.")
	}

	// 2. Расчет аннуитетного платежа и DTI
	testPayment := s.CalculateMonthlyPayment(requestedAmount, product.BaseInterestRate, requestedTermMonths)
	monthlyIncome := company.AnnualRevenue / 12.0
	totalMonthlyDebt := company.MonthlyDebtPayment + testPayment
	dti := 0.0
	if monthlyIncome > 0 {
		dti = (totalMonthlyDebt / monthlyIncome) * 100.0
	}

	// 3. Расчет баллов по факторам (Explainable Scoring)

	// Фактор А: Срок существования бизнеса
	var ageImpact int
	var ageDesc string
	if businessAgeMonths >= 36 {
		ageImpact = 100
		ageDesc = fmt.Sprintf("Бизнес ведет деятельность более 3 лет (%d мес.) — высокая стабильность", businessAgeMonths)
	} else if businessAgeMonths >= 12 {
		ageImpact = 60
		ageDesc = fmt.Sprintf("Бизнес на рынке более года (%d мес.) — подтвержденная устойчивость", businessAgeMonths)
	} else {
		ageImpact = -40
		ageDesc = fmt.Sprintf("Молодой бизнес (%d мес.) — повышенный фактор риска", businessAgeMonths)
	}
	factors = append(factors, domain.ScoringFactor{
		Name:        "Возраст бизнеса",
		Category:    "STABILITY",
		Value:       fmt.Sprintf("%d мес.", businessAgeMonths),
		Weight:      0.2,
		ScoreImpact: ageImpact,
		Description: ageDesc,
		IsPositive:  ageImpact > 0,
	})
	baseScore += ageImpact

	// Фактор Б: Кредитный рейтинг БКИ
	var bkiImpact int
	var bkiDesc string
	if company.BkiScore >= 750 {
		bkiImpact = 160
		bkiDesc = fmt.Sprintf("Отличная кредитная история (%d/850), отсутствие просрочек", company.BkiScore)
	} else if company.BkiScore >= 640 {
		bkiImpact = 80
		bkiDesc = fmt.Sprintf("Удовлетворительный кредитный рейтинг (%d/850), умеренная дисциплина", company.BkiScore)
	} else if company.BkiScore >= 550 {
		bkiImpact = 20
		bkiDesc = fmt.Sprintf("Средний кредитный рейтинг (%d/850)", company.BkiScore)
	} else {
		bkiImpact = -100
		bkiDesc = fmt.Sprintf("Пониженный кредитный рейтинг (%d/850), были технические задержки платежей", company.BkiScore)
	}
	factors = append(factors, domain.ScoringFactor{
		Name:        "Кредитная история (БКИ)",
		Category:    "CREDIT_HISTORY",
		Value:       fmt.Sprintf("%d / 850", company.BkiScore),
		Weight:      0.25,
		ScoreImpact: bkiImpact,
		Description: bkiDesc,
		IsPositive:  bkiImpact > 0,
	})
	baseScore += bkiImpact

	// Фактор В: Отношение запрашиваемой суммы к выручке
	amountToRevRatio := (requestedAmount / company.AnnualRevenue) * 100.0
	var revImpact int
	var revDesc string
	if amountToRevRatio <= 20.0 {
		revImpact = 100
		revDesc = fmt.Sprintf("Запрошенная сумма составляет всего %.1f%% от годовой выручки (безопасный объем)", amountToRevRatio)
	} else if amountToRevRatio <= 40.0 {
		revImpact = 40
		revDesc = fmt.Sprintf("Запрошенная сумма составляет %.1f%% от годовой выручки (приемлемый объем)", amountToRevRatio)
	} else {
		revImpact = -80
		revDesc = fmt.Sprintf("Запрошенная сумма (%.1f%% выручки) превышает рекомендованные лимиты для оборота", amountToRevRatio)
	}
	factors = append(factors, domain.ScoringFactor{
		Name:        "Объем к выручке",
		Category:    "FINANCIAL",
		Value:       fmt.Sprintf("%.1f%%", amountToRevRatio),
		Weight:      0.2,
		ScoreImpact: revImpact,
		Description: revDesc,
		IsPositive:  revImpact > 0,
	})
	baseScore += revImpact

	// Фактор Г: Коэффициент долговой нагрузки (DTI)
	var dtiImpact int
	var dtiDesc string
	if dti <= 35.0 {
		dtiImpact = 100
		dtiDesc = fmt.Sprintf("Комфортная долговая нагрузка (DTI %.1f%%) — денежного потока достаточно с запасом", dti)
	} else if dti <= 50.0 {
		dtiImpact = 30
		dtiDesc = fmt.Sprintf("Умеренная долговая нагрузка (DTI %.1f%%) — в пределах допустимых нормативов", dti)
	} else {
		dtiImpact = -100
		dtiDesc = fmt.Sprintf("Высокая долговая нагрузка (DTI %.1f%%) — риск кассовых разрывов при обслуживании долга", dti)
		recommendations = append(recommendations, "Снизить ежемесячный платеж за счет увеличения срока финансирования либо частичного рефинансирования.")
	}
	factors = append(factors, domain.ScoringFactor{
		Name:        "Долговая нагрузка (DTI)",
		Category:    "FINANCIAL",
		Value:       fmt.Sprintf("%.1f%%", dti),
		Weight:      0.2,
		ScoreImpact: dtiImpact,
		Description: dtiDesc,
		IsPositive:  dtiImpact > 0,
	})
	baseScore += dtiImpact

	// Фактор Д: Отношения с Альфа-Банком (РКО)
	var alfaImpact int
	var alfaDesc string
	alfaStatus := "Новый клиент"
	if company.HasAccountInAlfa {
		alfaImpact = 60
		alfaDesc = "Клиент обслуживается в Альфа-Банке — прозрачные обороты по РКО, сниженная риск-премия (-0.5% к ставке)"
		alfaStatus = "Клиент Альфа-Банка"
	} else {
		alfaImpact = 0
		alfaDesc = "Расчетный счет открыт в стороннем банке"
	}
	factors = append(factors, domain.ScoringFactor{
		Name:        "Клиентская история",
		Category:    "REPUTATION",
		Value:       alfaStatus,
		Weight:      0.1,
		ScoreImpact: alfaImpact,
		Description: alfaDesc,
		IsPositive:  alfaImpact > 0,
	})
	baseScore += alfaImpact

	// Фактор Е: Налоговая дисциплина и судебные споры
	if company.HasTaxArrears && company.TaxArrearsAmount <= 300_000 {
		baseScore -= 60
		factors = append(factors, domain.ScoringFactor{
			Name:        "Задолженность ФНС",
			Category:    "REPUTATION",
			Value:       fmt.Sprintf("%.0f ₽", company.TaxArrearsAmount),
			Weight:      0.05,
			ScoreImpact: -60,
			Description: "Имеется текущая задолженность перед налоговой инспекцией",
			IsPositive:  false,
		})
	}
	if company.CourtCasesCount > 0 {
		impact := 40 * company.CourtCasesCount
		baseScore -= impact
		factors = append(factors, domain.ScoringFactor{
			Name:        "Арбитраж / Судебные дела",
			Category:    "REPUTATION",
			Value:       fmt.Sprintf("%d дел на сумму %.0f ₽", company.CourtCasesCount, company.CourtCasesAmount),
			Weight:      0.05,
			ScoreImpact: -impact,
			Description: "Участие в судебных разбирательствах в качестве ответчика",
			IsPositive:  false,
		})
	}

	// Ограничиваем скор в диапазоне 0 - 1000
	if baseScore < 0 {
		baseScore = 0
	} else if baseScore > 1000 {
		baseScore = 1000
	}

	// Определение уровня риска
	riskLevel := "LOW"
	if baseScore < 450 {
		riskLevel = "CRITICAL"
	} else if baseScore < 600 {
		riskLevel = "HIGH"
	} else if baseScore < 720 {
		riskLevel = "MEDIUM"
	}

	// Расчет ставки с учетом риска и лояльности
	rate := product.BaseInterestRate
	if company.HasAccountInAlfa {
		rate -= 0.5
	}
	if riskLevel == "LOW" {
		rate -= 0.5
	} else if riskLevel == "HIGH" {
		rate += 1.5
	}

	// Расчет максимального безопасного лимита (исходя из DTI <= 40%)
	maxMonthlyAllowedDebt := (monthlyIncome * 0.40) - company.MonthlyDebtPayment
	if maxMonthlyAllowedDebt < 0 {
		maxMonthlyAllowedDebt = monthlyIncome * 0.15
	}
	// Обратный расчет суммы из аннуитета
	monthlyRate := rate / 12.0 / 100.0
	term := float64(requestedTermMonths)
	factor := math.Pow(1.0+monthlyRate, term)
	maxSafeAmount := maxMonthlyAllowedDebt * (factor - 1.0) / (monthlyRate * factor)
	maxSafeAmount = math.Min(maxSafeAmount, product.MaxAmount)
	maxSafeAmount = math.Max(maxSafeAmount, product.MinAmount)
	maxSafeAmount = math.Round(maxSafeAmount/50_000.0) * 50_000.0 // Округление до 50 тыс.

	// Логика принятия решения
	var decisionType string

	// 1. Отказ при стоп-факторах или критическом скоринге
	if len(stopFactors) > 0 || baseScore < 450 {
		decisionType = "REJECT"
	} else if (company.HasTaxArrears && company.TaxArrearsAmount > 0) || company.CourtCasesCount >= 2 {
		// 2. Эскалация на андеррайтера при наличии спорных арбитражей или налоговых задолженностей
		decisionType = "MANUAL_REVIEW"
	} else if requestedAmount > maxSafeAmount || dti > 45.0 {
		// 3. Встречное предложение (Counter-Offer) при превышении комфортного лимита/нагрузки
		decisionType = "COUNTER_OFFER"
	} else if baseScore >= 700 {
		// 4. Полное автоодобрение
		decisionType = "APPROVE"
	} else {
		// 5. Пограничный скоринг в серой зоне
		decisionType = "MANUAL_REVIEW"
	}

	return domain.ScoringResult{
		ID:                  uuid.New(),
		TotalScore:          baseScore,
		RiskLevel:           riskLevel,
		RecommendedDecision: decisionType,
		MaxApprovedAmount:   maxSafeAmount,
		RecommendedRate:     math.Round(rate*10) / 10,
		DTI:                 math.Round(dti*10) / 10,
		Factors:             factors,
		StopFactors:         stopFactors,
		Recommendations:     recommendations,
		CreatedAt:           now,
	}
}
