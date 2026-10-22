package service

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/kanef1/credit_swinki/backend/internal/domain"
)

// EnrichmentService эмулирует интеграции с ФНС, ЕГРЮЛ/ЕГРИП, «Прозрачным бизнесом» и БКИ
type EnrichmentService struct {
	knownCompanies map[string]domain.Company
}

// NewEnrichmentService инициализирует сервис обогащения с 4 эталонными синтетическими профилями
func NewEnrichmentService() *EnrichmentService {
	s := &EnrichmentService{
		knownCompanies: make(map[string]domain.Company),
	}
	s.initSyntheticData()
	return s
}

func (s *EnrichmentService) initSyntheticData() {
	now := time.Now()

	// 1. Идеальный заемщик: ООО «Вектор Роста» (Автоодобрение)
	s.knownCompanies["7701234567"] = domain.Company{
		ID:                 uuid.New(),
		INN:                "7701234567",
		OGRN:               "1197746123456",
		Name:               `ООО "Вектор Роста"`,
		LegalForm:          "OOO",
		RegistrationDate:   now.AddDate(-4, -2, 0), // 4+ года бизнесу
		DirectorName:       "Воронов Сергей Александрович",
		Address:            "г. Москва, ул. Тверская, д. 12, стр. 2",
		OKVED:              "62.01",
		OKVEDDescription:   "Разработка компьютерного программного обеспечения",
		AnnualRevenue:      58_000_000,
		NetProfit:          12_400_000,
		EmployeeCount:      24,
		TaxSystem:          "УСН (Доходы минус расходы)",
		HasTaxArrears:      false,
		TaxArrearsAmount:   0,
		CourtCasesCount:    0,
		CourtCasesAmount:   0,
		BkiScore:           820, // Высокий кредитный рейтинг (макс ~850)
		ExistingDebt:       1_200_000,
		MonthlyDebtPayment: 85_000,
		HasAccountInAlfa:   true,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	// 2. Пограничный заемщик: ИП Смирнов А.В. (Встречное предложение / Counter-offer)
	s.knownCompanies["7809876543"] = domain.Company{
		ID:                 uuid.New(),
		INN:                "7809876543",
		OGRN:               "322784700012345",
		Name:               `ИП Смирнов Алексей Владимирович`,
		LegalForm:          "IP",
		RegistrationDate:   now.AddDate(-1, -8, 0), // 1.8 года
		DirectorName:       "Смирнов Алексей Владимирович",
		Address:            "г. Санкт-Петербург, Невский пр-т, д. 45",
		OKVED:              "47.19",
		OKVEDDescription:   "Торговля розничная прочая в неспециализированных магазинах",
		AnnualRevenue:      18_500_000,
		NetProfit:          2_900_000,
		EmployeeCount:      6,
		TaxSystem:          "УСН (Доходы)",
		HasTaxArrears:      false,
		TaxArrearsAmount:   0,
		CourtCasesCount:    1,
		CourtCasesAmount:   45_000,
		BkiScore:           655, // Средний скоринг
		ExistingDebt:       3_400_000,
		MonthlyDebtPayment: 190_000, // Высокая нагрузка
		HasAccountInAlfa:   false,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	// 3. Заемщик с вопросами: ООО «ТехноПром Инжиниринг» (Ручной андеррайтинг)
	s.knownCompanies["5001122334"] = domain.Company{
		ID:                 uuid.New(),
		INN:                "5001122334",
		OGRN:               "1215000045678",
		Name:               `ООО "ТехноПром Инжиниринг"`,
		LegalForm:          "OOO",
		RegistrationDate:   now.AddDate(-2, -1, 0), // 2 года
		DirectorName:       "Кузнецов Михаил Юрьевич",
		Address:            "Московская обл., г. Химки, ул. Ленинградская, д. 29",
		OKVED:              "28.29",
		OKVEDDescription:   "Производство прочих машин и оборудования общего назначения",
		AnnualRevenue:      36_000_000,
		NetProfit:          4_100_000,
		EmployeeCount:      18,
		TaxSystem:          "ОСНО",
		HasTaxArrears:      true,
		TaxArrearsAmount:   48_000, // Небольшая задолженность в процессе сверки
		CourtCasesCount:    2,
		CourtCasesAmount:   320_000,
		BkiScore:           610,
		ExistingDebt:       4_500_000,
		MonthlyDebtPayment: 260_000,
		HasAccountInAlfa:   true,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	// 4. Отказной заемщик: ООО «СтройГрупп Риск» (Стоп-факторы, отказ + Кредитный доктор)
	s.knownCompanies["9705544332"] = domain.Company{
		ID:                 uuid.New(),
		INN:                "9705544332",
		OGRN:               "1247700099887",
		Name:               `ООО "СтройГрупп Риск"`,
		LegalForm:          "OOO",
		RegistrationDate:   now.AddDate(0, -3, 0), // Всего 3 месяца бизнесу! (стоп-фактор)
		DirectorName:       "Макаров Денис Игоревич",
		Address:            "г. Москва, ш. Энтузиастов, д. 19 (массовый адрес)",
		OKVED:              "41.20",
		OKVEDDescription:   "Строительство жилых и нежилых зданий",
		AnnualRevenue:      3_800_000,
		NetProfit:          -420_000, // Убыточный баланс
		EmployeeCount:      2,
		TaxSystem:          "ОСНО",
		HasTaxArrears:      true,
		TaxArrearsAmount:   410_000, // Существенная задолженность перед бюджетом
		CourtCasesCount:    5,
		CourtCasesAmount:   2_400_000,
		BkiScore:           415, // Низкий рейтинг БКИ, наличие просрочек > 60 дней
		ExistingDebt:       2_900_000,
		MonthlyDebtPayment: 150_000,
		HasAccountInAlfa:   false,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}

// GetCompanyByINN ищет компанию среди синтетических или детерминированно генерирует реалистичный профиль
func (s *EnrichmentService) GetCompanyByINN(inn string) (domain.Company, error) {
	inn = strings.TrimSpace(inn)
	if len(inn) != 10 && len(inn) != 12 {
		return domain.Company{}, fmt.Errorf("некорректная длина ИНН (%d цифр), требуется 10 (для ЮЛ) или 12 (для ИП)", len(inn))
	}

	// Проверяем известные тестовые сценарии
	if comp, ok := s.knownCompanies[inn]; ok {
		return comp, nil
	}

	// Если введен произвольный ИНН экспертом жюри — генерируем детерминированный профиль
	return s.generateDeterministicCompany(inn), nil
}

// GetAllSyntheticCompanies возвращает список эталонных компаний для UI быстрого выбора
func (s *EnrichmentService) GetAllSyntheticCompanies() []domain.Company {
	keys := []string{"7701234567", "7809876543", "5001122334", "9705544332"}
	result := make([]domain.Company, 0, len(keys))
	for _, k := range keys {
		if c, ok := s.knownCompanies[k]; ok {
			result = append(result, c)
		}
	}
	return result
}

func (s *EnrichmentService) generateDeterministicCompany(inn string) domain.Company {
	hash := sha256.Sum256([]byte(inn))
	val := binary.BigEndian.Uint64(hash[:8])
	now := time.Now()

	isIP := len(inn) == 12
	legalForm := "OOO"
	if isIP {
		legalForm = "IP"
	}

	years := int(1 + (val % 7))
	revenue := float64(10_000_000 + int64(val%90_000_000))
	profitMargin := 0.12 + float64(val%15)/100.0
	netProfit := revenue * profitMargin
	bkiScore := int(550 + (val % 280))

	name := fmt.Sprintf(`ООО "Компания-%s"`, inn[len(inn)-4:])
	director := "Александров Петр Васильевич"
	if isIP {
		name = fmt.Sprintf("ИП Сидоров Иван Петрович (%s)", inn[len(inn)-4:])
		director = "Сидоров Иван Петрович"
	}

	return domain.Company{
		ID:                 uuid.New(),
		INN:                inn,
		OGRN:               fmt.Sprintf("1%012d", val%1_000_000_000_000),
		Name:               name,
		LegalForm:          legalForm,
		RegistrationDate:   now.AddDate(-years, -int(val%11), 0),
		DirectorName:       director,
		Address:            "г. Москва, Кутузовский проспект, д. 32",
		OKVED:              "46.90",
		OKVEDDescription:   "Торговля оптовая неспециализированная",
		AnnualRevenue:      math.Round(revenue),
		NetProfit:          math.Round(netProfit),
		EmployeeCount:      int(3 + (val % 35)),
		TaxSystem:          "УСН (Доходы минус расходы)",
		HasTaxArrears:      false,
		TaxArrearsAmount:   0,
		CourtCasesCount:    int(val % 2),
		CourtCasesAmount:   0,
		BkiScore:           bkiScore,
		ExistingDebt:       math.Round(revenue * 0.1),
		MonthlyDebtPayment: math.Round((revenue * 0.1) / 24),
		HasAccountInAlfa:   (val % 2) == 0,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}
