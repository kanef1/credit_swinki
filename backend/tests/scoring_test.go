package tests

import (
	"testing"

	"github.com/kanef1/credit_swinki/backend/internal/domain"
	"github.com/kanef1/credit_swinki/backend/internal/service"
)

func TestFSMTransitions(t *testing.T) {
	// 1. Корректные переходы
	validCases := [][2]domain.ApplicationStatus{
		{domain.StatusDraft, domain.StatusSubmitted},
		{domain.StatusSubmitted, domain.StatusEnriching},
		{domain.StatusEnriching, domain.StatusScoring},
		{domain.StatusScoring, domain.StatusOfferReady},
		{domain.StatusScoring, domain.StatusManualReview},
		{domain.StatusScoring, domain.StatusRejected},
		{domain.StatusManualReview, domain.StatusOfferReady},
		{domain.StatusManualReview, domain.StatusRejected},
		{domain.StatusOfferReady, domain.StatusSigned},
		{domain.StatusSigned, domain.StatusDisbursed},
	}

	for _, c := range validCases {
		if !domain.CanTransition(c[0], c[1]) {
			t.Errorf("Ожидался допустимый переход из %s в %s, но CanTransition вернул false", c[0], c[1])
		}
	}

	// 2. Недопустимые переходы
	invalidCases := [][2]domain.ApplicationStatus{
		{domain.StatusDraft, domain.StatusDisbursed},
		{domain.StatusDraft, domain.StatusSigned},
		{domain.StatusRejected, domain.StatusOfferReady},
		{domain.StatusDisbursed, domain.StatusScoring},
	}

	for _, c := range invalidCases {
		if domain.CanTransition(c[0], c[1]) {
			t.Errorf("Переход из %s в %s должен быть заблокирован", c[0], c[1])
		}
	}
}

func TestScoringScenarios(t *testing.T) {
	enrichment := service.NewEnrichmentService()
	scoring := service.NewScoringService()

	product := domain.CreditProduct{
		ID:               "working-capital",
		BaseInterestRate: 14.5,
		MinAmount:        500_000,
		MaxAmount:        30_000_000,
	}

	// Кейс 1: Идеальный заемщик (7701234567 - ООО "Вектор Роста") -> Автоодобрение
	c1, err := enrichment.GetCompanyByINN("7701234567")
	if err != nil {
		t.Fatalf("Ошибка получения компании: %v", err)
	}
	res1 := scoring.Evaluate(&c1, &product, 5_000_000, 24)
	if res1.RecommendedDecision != "APPROVE" {
		t.Errorf("Кейс 1: Ожидалось APPROVE, получено: %s (скор: %d)", res1.RecommendedDecision, res1.TotalScore)
	}
	if res1.TotalScore < 720 {
		t.Errorf("Кейс 1: Ожидался скор >= 720, получено: %d", res1.TotalScore)
	}
	if len(res1.StopFactors) > 0 {
		t.Errorf("Кейс 1: У идеального заемщика не должно быть стоп-факторов: %v", res1.StopFactors)
	}

	// Кейс 2: Пограничный заемщик с высокой нагрузкой (7809876543 - ИП Смирнов) -> Counter-Offer
	c2, err := enrichment.GetCompanyByINN("7809876543")
	if err != nil {
		t.Fatalf("Ошибка получения компании: %v", err)
	}
	res2 := scoring.Evaluate(&c2, &product, 6_000_000, 12)
	t.Logf("Кейс 2: скор=%d, decision=%s, dti=%.1f, maxSafe=%.0f", res2.TotalScore, res2.RecommendedDecision, res2.DTI, res2.MaxApprovedAmount)
	if res2.RecommendedDecision != "COUNTER_OFFER" {
		t.Errorf("Кейс 2: Ожидалось COUNTER_OFFER, получено: %s", res2.RecommendedDecision)
	}
	if res2.MaxApprovedAmount >= 6_000_000 {
		t.Errorf("Кейс 2: Скорректированный лимит должен быть меньше запрошенного 6 млн, получено: %.0f", res2.MaxApprovedAmount)
	}

	// Кейс 3: Заемщик с вопросами (5001122334 - ООО "ТехноПром") -> MANUAL_REVIEW
	c3, err := enrichment.GetCompanyByINN("5001122334")
	if err != nil {
		t.Fatalf("Ошибка получения компании: %v", err)
	}
	res3 := scoring.Evaluate(&c3, &product, 4_000_000, 36)
	t.Logf("Кейс 3: скор=%d, decision=%s, stopFactors=%v", res3.TotalScore, res3.RecommendedDecision, res3.StopFactors)
	if res3.RecommendedDecision != "MANUAL_REVIEW" {
		t.Errorf("Кейс 3: Ожидалось MANUAL_REVIEW, получено: %s", res3.RecommendedDecision)
	}

	// Кейс 4: Заемщик со стоп-факторами (9705544332 - ООО "СтройГрупп Риск") -> REJECT
	c4, err := enrichment.GetCompanyByINN("9705544332")
	if err != nil {
		t.Fatalf("Ошибка получения компании: %v", err)
	}
	res4 := scoring.Evaluate(&c4, &product, 3_000_000, 18)
	if res4.RecommendedDecision != "REJECT" {
		t.Errorf("Кейс 4: Ожидался REJECT, получено: %s", res4.RecommendedDecision)
	}
	if len(res4.StopFactors) == 0 {
		t.Errorf("Кейс 4: Должны быть зафиксированы стоп-факторы")
	}
	if len(res4.Recommendations) == 0 {
		t.Errorf("Кейс 4: Должны присутствовать рекомендации 'Кредитного доктора'")
	}
}

func TestAnnuityCalculation(t *testing.T) {
	scoring := service.NewScoringService()
	// Проверка расчета: 1 000 000 руб. на 12 мес. под 12% годовых
	// Месячная ставка = 1%. Аннуитет = 1 000 000 * (0.01 * 1.01^12) / (1.01^12 - 1) ≈ 88 849 руб.
	payment := scoring.CalculateMonthlyPayment(1_000_000, 12.0, 12)
	if payment < 88_800 || payment > 88_900 {
		t.Errorf("Некорректный расчет аннуитета: получено %.0f, ожидалось ~88849", payment)
	}
}
