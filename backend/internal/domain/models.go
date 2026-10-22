package domain

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// ApplicationStatus представляет состояние заявки в конечном автомате (FSM)
type ApplicationStatus string

const (
	StatusDraft         ApplicationStatus = "DRAFT"          // Черновик заявки
	StatusSubmitted     ApplicationStatus = "SUBMITTED"      // Заявка отправлена клиентом
	StatusEnriching     ApplicationStatus = "ENRICHING"      // Обогащение данными (ФНС, БКИ, реестры)
	StatusScoring       ApplicationStatus = "SCORING"        // Скоринг и риск-проверка
	StatusManualReview  ApplicationStatus = "MANUAL_REVIEW"  // На ручном рассмотрении у андеррайтера
	StatusOfferReady    ApplicationStatus = "OFFER_READY"    // Предложение сформировано (одобрено или контр-оффер)
	StatusSigned        ApplicationStatus = "SIGNED"         // Договор подписан клиентом (ПЭП)
	StatusDisbursed     ApplicationStatus = "DISBURSED"      // Средства зачислены на счет
	StatusRejected      ApplicationStatus = "REJECTED"       // Отказ в выдаче
)

// Company описывает субъекта МСП (ООО или ИП)
type Company struct {
	ID                  uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	INN                 string    `gorm:"size:12;uniqueIndex;not null" json:"inn"`
	OGRN                string    `gorm:"size:15" json:"ogrn"`
	Name                string    `gorm:"size:255;not null" json:"name"`
	LegalForm           string    `gorm:"size:10;not null" json:"legal_form"` // OOO, IP
	RegistrationDate    time.Time `json:"registration_date"`
	DirectorName        string    `gorm:"size:255" json:"director_name"`
	Address             string    `gorm:"size:500" json:"address"`
	OKVED               string    `gorm:"size:10" json:"okved"`
	OKVEDDescription    string    `gorm:"size:255" json:"okved_description"`
	AnnualRevenue       float64   `json:"annual_revenue"`        // Годовая выручка (руб)
	NetProfit           float64   `json:"net_profit"`            // Чистая прибыль (руб)
	EmployeeCount       int       `json:"employee_count"`        // Число сотрудников
	TaxSystem           string    `gorm:"size:50" json:"tax_system"` // ОСНО, УСН
	HasTaxArrears       bool      `json:"has_tax_arrears"`       // Есть задолженность перед ФНС
	TaxArrearsAmount    float64   `json:"tax_arrears_amount"`    // Сумма задолженности ФНС
	CourtCasesCount     int       `json:"court_cases_count"`     // Количество судебных/арбитражных дел
	CourtCasesAmount    float64   `json:"court_cases_amount"`    // Сумма исков
	BkiScore            int       `json:"bki_score"`             // Скоринговый балл БКИ (300-850)
	ExistingDebt        float64   `json:"existing_debt"`         // Текущий остаток долга по кредитам
	MonthlyDebtPayment  float64   `json:"monthly_debt_payment"`  // Ежемесячный платеж по текущим обязательствам
	HasAccountInAlfa    bool      `json:"has_account_in_alfa"`   // Открыт ли расчетный счет в Альфа-Банке
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// CreditProduct описывает параметры банковского кредитного продукта
type CreditProduct struct {
	ID                 string    `gorm:"primary_key;size:50" json:"id"`
	Name               string    `gorm:"size:255;not null" json:"name"`
	Description        string    `gorm:"type:text" json:"description"`
	TargetAudience     string    `gorm:"size:255" json:"target_audience"`
	MinAmount          float64   `json:"min_amount"`
	MaxAmount          float64   `json:"max_amount"`
	MinTermMonths      int       `json:"min_term_months"`
	MaxTermMonths      int       `json:"max_term_months"`
	BaseInterestRate   float64   `json:"base_interest_rate"` // Базовая ставка в % годовых
	RequiresCollateral bool      `json:"requires_collateral"`
	GracePeriodMonths  int       `json:"grace_period_months"`
	IsActive           bool      `gorm:"default:true" json:"is_active"`
	CreatedAt          time.Time `json:"created_at"`
}

// Application описывает кредитную заявку
type Application struct {
	ID                  uuid.UUID         `gorm:"type:uuid;primary_key" json:"id"`
	ApplicationNumber   string            `gorm:"size:32;uniqueIndex;not null" json:"application_number"`
	CompanyID           uuid.UUID         `gorm:"type:uuid;not null;index" json:"company_id"`
	Company             *Company          `gorm:"foreignKey:CompanyID" json:"company,omitempty"`
	ProductID           string            `gorm:"size:50;not null" json:"product_id"`
	Product             *CreditProduct    `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	RequestedAmount     float64           `json:"requested_amount"`
	RequestedTermMonths int               `json:"requested_term_months"`
	FinancingGoal       string            `gorm:"size:50" json:"financing_goal"` // WORKING_CAPITAL, EQUIPMENT, etc.
	RepaymentType       string            `gorm:"size:20;default:'ANNUITY'" json:"repayment_type"`
	Status              ApplicationStatus `gorm:"size:30;not null;index" json:"status"`
	
	// Поля решения
	ApprovedAmount      float64    `json:"approved_amount"`
	ApprovedTermMonths  int        `json:"approved_term_months"`
	ApprovedRate        float64    `json:"approved_rate"`
	MonthlyPayment      float64    `json:"monthly_payment"`
	IsCounterOffer      bool       `json:"is_counter_offer"`
	CounterOfferReason  string     `gorm:"size:500" json:"counter_offer_reason,omitempty"`
	RejectionReason     string     `gorm:"size:500" json:"rejection_reason,omitempty"`
	UnderwriterNotes    string     `gorm:"type:text" json:"underwriter_notes,omitempty"`
	
	// СМС-подтверждение и выдача (in-app симуляция)
	SMSCode             string     `gorm:"size:6" json:"sms_code,omitempty"`
	SignedAt            *time.Time `json:"signed_at,omitempty"`
	DisbursedAt         *time.Time `json:"disbursed_at,omitempty"`
	
	// Связанные сущности
	ScoringResult       *ScoringResult        `gorm:"foreignKey:ApplicationID" json:"scoring_result,omitempty"`
	AuditLogs           []ApplicationAuditLog `gorm:"foreignKey:ApplicationID;order:created_at asc" json:"audit_logs,omitempty"`
	Documents           []ApplicationDocument `gorm:"foreignKey:ApplicationID" json:"documents,omitempty"`
	
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// ScoringFactor описывает отдельный компонент оценки скоринга
type ScoringFactor struct {
	Name        string  `json:"name"`        // Название фактора (например, "Возраст бизнеса")
	Category    string  `json:"category"`    // Категория: FINANCIAL, REPUTATION, CREDIT_HISTORY, STABILITY
	Value       string  `json:"value"`       // Значение (например, "3.5 года")
	Weight      float64 `json:"weight"`      // Вес фактора в модели
	ScoreImpact int     `json:"score_impact"`// Влияние на балл (+80 или -120)
	Description string  `json:"description"` // Понятное предпринимателю объяснение
	IsPositive  bool    `json:"is_positive"` // Положительное или отрицательное влияние
}

// FactorsList - вспомогательный тип для сериализации в JSON
type FactorsList []ScoringFactor

func (fl FactorsList) Value() (driver.Value, error) {
	return json.Marshal(fl)
}

func (fl *FactorsList) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed for FactorsList")
	}
	return json.Unmarshal(bytes, fl)
}

// StringList - вспомогательный тип для сериализации слайса строк
type StringList []string

func (sl StringList) Value() (driver.Value, error) {
	return json.Marshal(sl)
}

func (sl *StringList) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed for StringList")
	}
	return json.Unmarshal(bytes, sl)
}

// ScoringResult результат работы риск-модели
type ScoringResult struct {
	ID                  uuid.UUID   `gorm:"type:uuid;primary_key" json:"id"`
	ApplicationID       uuid.UUID   `gorm:"type:uuid;uniqueIndex;not null" json:"application_id"`
	TotalScore          int         `json:"total_score"`           // Балл от 0 до 1000
	RiskLevel           string      `gorm:"size:20" json:"risk_level"` // LOW, MEDIUM, HIGH, CRITICAL
	RecommendedDecision string      `gorm:"size:30" json:"recommended_decision"` // APPROVE, COUNTER_OFFER, MANUAL_REVIEW, REJECT
	MaxApprovedAmount   float64     `json:"max_approved_amount"`
	RecommendedRate     float64     `json:"recommended_rate"`
	DTI                 float64     `json:"dti"`                   // Коэффициент долговой нагрузки (Debt-to-Income, в %)
	Factors             FactorsList `gorm:"type:text" json:"factors"`
	StopFactors         StringList  `gorm:"type:text" json:"stop_factors"`
	Recommendations     StringList  `gorm:"type:text" json:"recommendations"` // Рекомендации Кредитного доктора
	CreatedAt           time.Time   `json:"created_at"`
}

// ApplicationAuditLog фиксирует каждое изменение статуса конвейера
type ApplicationAuditLog struct {
	ID            uuid.UUID         `gorm:"type:uuid;primary_key" json:"id"`
	ApplicationID uuid.UUID         `gorm:"type:uuid;index;not null" json:"application_id"`
	FromStatus    ApplicationStatus `gorm:"size:30" json:"from_status"`
	ToStatus      ApplicationStatus `gorm:"size:30;not null" json:"to_status"`
	ActorRole     string            `gorm:"size:30;not null" json:"actor_role"` // CLIENT, SYSTEM, UNDERWRITER
	Comment       string            `gorm:"size:500" json:"comment"`
	CreatedAt     time.Time         `json:"created_at"`
}

// ApplicationDocument описывает документы компании/заявки
type ApplicationDocument struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	ApplicationID uuid.UUID `gorm:"type:uuid;index;not null" json:"application_id"`
	DocType       string    `gorm:"size:50;not null" json:"doc_type"` // FINANCIAL_REPORT, BANK_STATEMENT, PASSPORT
	FileName      string    `gorm:"size:255;not null" json:"file_name"`
	FileSize      int64     `json:"file_size"`
	Status        string    `gorm:"size:30;default:'VERIFIED'" json:"status"`
	Summary       string    `gorm:"size:500" json:"summary"`
	CreatedAt     time.Time `json:"created_at"`
}
