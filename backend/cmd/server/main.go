package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/kanef1/credit_swinki/backend/internal/handler"
	"github.com/kanef1/credit_swinki/backend/internal/repository"
	"github.com/kanef1/credit_swinki/backend/internal/service"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/kanef1/credit_swinki/backend/docs"
)

// @title Альфа Хак — API Цифрового Кредитного Конвейера МСП
// @version 1.0
// @description REST API сквозного кредитного конвейера для малого и микробизнеса (Альфа-Банк).
// @contact.name Команда разработки (kanef1)
// @contact.email derluckin@yandex.ru
// @host localhost:8080
// @BasePath /
func main() {
	log.Println("=== Запуск Цифрового Кредитного Конвейера (Альфа-Банк) ===")

	// 1. Инициализация БД
	repo, err := repository.InitDB()
	if err != nil {
		log.Fatalf("Фатальная ошибка инициализации БД: %v", err)
	}

	// 2. Инициализация сервисов
	enrichmentService := service.NewEnrichmentService()
	scoringService := service.NewScoringService()
	pipelineService := service.NewPipelineService(repo, enrichmentService, scoringService)

	// 3. Инициализация обработчиков
	h := handler.NewHandler(pipelineService, enrichmentService)

	// 4. Настройка веб-сервера
	router := gin.Default()

	// Настройка CORS для работы с React фронтендом
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "Accept"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	router.Use(cors.New(corsConfig))

	// Регистрация Swagger
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	router.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/swagger/index.html")
	})

	// Регистрация маршрутов API
	v1 := router.Group("/api/v1")
	{
		v1.GET("/health", h.HealthCheck)
		v1.GET("/products", h.GetProducts)

		// Демо-сценарии для жюри
		demo := v1.Group("/demo")
		{
			demo.GET("/companies", h.GetDemoCompanies)
			demo.POST("/seed", h.SeedDemoData)
		}

		// Поиск компаний (обогащение ФНС / БКИ)
		v1.GET("/companies/lookup", h.LookupCompany)

		// Кредитные заявки (клиентский контур)
		apps := v1.Group("/applications")
		{
			apps.POST("", h.CreateApplication)
			apps.GET("", h.ListApplications)
			apps.GET("/:id", h.GetApplication)
			apps.POST("/:id/submit", h.SubmitApplication)
			apps.POST("/:id/sign", h.SignOffer)
		}

		// Кабинет андеррайтера (банковский контур)
		underwriter := v1.Group("/underwriter")
		{
			underwriter.GET("/stats", h.GetStats)
			underwriter.POST("/applications/:id/approve", h.UnderwriterApprove)
			underwriter.POST("/applications/:id/reject", h.UnderwriterReject)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[Server] Сервер готов к обработке запросов на порту :%s", port)
	log.Printf("[Server] Документация Swagger доступна по адресу: http://localhost:%s/swagger/index.html", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Ошибка остановки сервера: %v", err)
	}
}
