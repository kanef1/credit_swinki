package repository

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/kanef1/credit_swinki/backend/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Repository инкапсулирует операции с базой данных
type Repository struct {
	DB *gorm.DB
}

// InitDB инициализирует подключение к PostgreSQL либо переключается на встроенный SQLite
func InitDB() (*Repository, error) {
	dsn := os.Getenv("DATABASE_URL")
	var dialector gorm.Dialector

	if dsn != "" {
		log.Printf("[DB] Подключение к PostgreSQL: %s", dsn)
		dialector = postgres.Open(dsn)
	} else {
		log.Println("[DB] Переменная DATABASE_URL не задана, используется локальный SQLite (credit_swinki.db)")
		dialector = sqlite.Open("credit_swinki.db")
	}

	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	}

	db, err := gorm.Open(dialector, gormConfig)
	if err != nil {
		if dsn != "" {
			log.Printf("[DB] Ошибка подключения к Postgres, fallback на SQLite: %v", err)
			db, err = gorm.Open(sqlite.Open("credit_swinki.db"), gormConfig)
			if err != nil {
				return nil, fmt.Errorf("не удалось открыть fallback SQLite: %w", err)
			}
		} else {
			return nil, fmt.Errorf("ошибка открытия БД: %w", err)
		}
	}

	// Автомиграция всех сущностей домена
	err = db.AutoMigrate(
		&domain.Company{},
		&domain.CreditProduct{},
		&domain.Application{},
		&domain.ScoringResult{},
		&domain.ApplicationAuditLog{},
		&domain.ApplicationDocument{},
	)
	if err != nil {
		return nil, fmt.Errorf("ошибка автомиграции БД: %w", err)
	}

	repo := &Repository{DB: db}
	repo.SeedInitialProducts()

	return repo, nil
}

// SeedInitialProducts наполняет каталог стандартными кредитными продуктами Альфа-Банка для МСП
func (r *Repository) SeedInitialProducts() {
	var count int64
	r.DB.Model(&domain.CreditProduct{}).Count(&count)
	if count > 0 {
		return
	}

	now := time.Now()
	products := []domain.CreditProduct{
		{
			ID:                 "working-capital",
			Name:               "Оборотный кредит «Бизнес-Драйв»",
			Description:        "Финансирование текущей деятельности: закупка товаров, сырья, оплата аренды и налогов без кассовых разрывов.",
			TargetAudience:     "Торговля, производство, сфера услуг",
			MinAmount:          500_000,
			MaxAmount:          30_000_000,
			MinTermMonths:      6,
			MaxTermMonths:      36,
			BaseInterestRate:   14.5,
			RequiresCollateral: false,
			GracePeriodMonths:  3,
			IsActive:           true,
			CreatedAt:          now,
		},
		{
			ID:                 "overdraft",
			Name:               "Экспресс-Овердрафт к счету",
			Description:        "Мгновенный доступ к деньгам при нулевом остатке на расчетном счете. Проценты только за фактические дни пользования.",
			TargetAudience:     "Клиенты с регулярными оборотами по РКО",
			MinAmount:          300_000,
			MaxAmount:          15_000_000,
			MinTermMonths:      3,
			MaxTermMonths:      12,
			BaseInterestRate:   13.9,
			RequiresCollateral: false,
			GracePeriodMonths:  0,
			IsActive:           true,
			CreatedAt:          now,
		},
		{
			ID:                 "equipment-investment",
			Name:               "Инвестиционный кредит на оборудование и транспорт",
			Description:        "Долгосрочное финансирование модернизации основных средств, покупки спецтехники, станков или коммерческой недвижимости.",
			TargetAudience:     "Производственные, логистические и строительные компании",
			MinAmount:          2_000_000,
			MaxAmount:          50_000_000,
			MinTermMonths:      12,
			MaxTermMonths:      60,
			BaseInterestRate:   15.5,
			RequiresCollateral: true,
			GracePeriodMonths:  6,
			IsActive:           true,
			CreatedAt:          now,
		},
		{
			ID:                 "express-smb",
			Name:               "Кредит «Быстрый старт для ИП»",
			Description:        "Минимальный пакет документов, решение за 2 минуты без залога и поручителей для микробизнеса.",
			TargetAudience:     "Индивидуальные предприниматели и микропредприятия",
			MinAmount:          200_000,
			MaxAmount:          5_000_000,
			MinTermMonths:      6,
			MaxTermMonths:      24,
			BaseInterestRate:   16.0,
			RequiresCollateral: false,
			GracePeriodMonths:  1,
			IsActive:           true,
			CreatedAt:          now,
		},
	}

	for _, p := range products {
		r.DB.Save(&p)
	}
	log.Printf("[DB] Инициализировано %d кредитных продуктов Альфа-Банка", len(products))
}

// LogTransition сохраняет запись в журнал аудита конвейера
func (r *Repository) LogTransition(appID uuid.UUID, from, to domain.ApplicationStatus, actorRole, comment string) {
	logEntry := domain.ApplicationAuditLog{
		ID:            uuid.New(),
		ApplicationID: appID,
		FromStatus:    from,
		ToStatus:      to,
		ActorRole:     actorRole,
		Comment:       comment,
		CreatedAt:     time.Now(),
	}
	r.DB.Create(&logEntry)
}
