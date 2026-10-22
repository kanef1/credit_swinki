# Архитектурное описание системы «Умный кредитный кабинет предпринимателя»

Документ описывает архитектурные решения, модель состояний, структуру данных и логику принятия кредитных решений конвейера Альфа-Банка.

---

## 1. Архитектурная схема (C4 Component Diagram)

Система построена по принципам Cloud-Native архитектуры с четким разделением клиентского контура, слоя бизнес-логики (конвейер и скоринг) и изолированного слоя данных.

```mermaid
flowchart TD
    subgraph ClientTier["Клиентский слой (Веб-интерфейс)"]
        UI_SMB["Кабинет предпринимателя\n(React 18 / Tailwind / Vite)"]
        UI_UW["Кабинет андеррайтера\n(Очередь заявок, Аналитика)"]
        UI_Demo["Панель жюри\n(Быстрый запуск 4 сценариев)"]
    end

    subgraph GatewayTier["Слой доставки и проксирования"]
        Nginx["Nginx Reverse Proxy & Static Cache\n(:3000 / :80)"]
    end

    subgraph AppTier["Серверный слой (Go Clean Architecture)"]
        Router["HTTP Router & Middleware (Gin)"]
        PipelineEngine["Движок кредитного конвейера\n(FSM State Machine)"]
        ScoringEngine["Explainable Scoring Engine\n(Расчет баллов 0-1000, DTI, Стоп-факторы)"]
        EnrichmentEngine["Сервис обогащения (Моки)\n(ФНС / ЕГРЮЛ, БКИ, Судебные реестры)"]
        AuditEngine["Подсистема аудита (Audit Trail)"]
    end

    subgraph DataTier["Слой персистентности"]
        Postgres[(PostgreSQL 16 / GORM)]
    end

    UI_SMB --> Nginx
    UI_UW --> Nginx
    UI_Demo --> Nginx

    Nginx -->|REST API / JSON| Router
    Router --> PipelineEngine
    PipelineEngine --> ScoringEngine
    PipelineEngine --> EnrichmentEngine
    PipelineEngine --> AuditEngine

    PipelineEngine --> Postgres
    ScoringEngine --> Postgres
    AuditEngine --> Postgres
```

---

## 2. Диаграмма состояний кредитной заявки (FSM)

Жизненный цикл заявки управляется конечным автоматом со строгой валидацией допустимости переходов и обязательным логированием аудита:

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Заполнение заявки клиентом
    DRAFT --> SUBMITTED: Отправка в конвейер
    SUBMITTED --> ENRICHING: Запуск сбора данных ФНС / БКИ
    ENRICHING --> SCORING: Данные получены
    
    SCORING --> OFFER_READY: Скор >= 700 (Автоодобрение)
    SCORING --> OFFER_READY: DTI > 45% (Встречное предложение / Counter-offer)
    SCORING --> MANUAL_REVIEW: Серая зона / Вопросы ФНС или судов
    SCORING --> REJECTED: Стоп-факторы / Скор < 450
    
    MANUAL_REVIEW --> OFFER_READY: Андеррайтер согласовал условия
    MANUAL_REVIEW --> REJECTED: Андеррайтер отклонил заявку
    
    OFFER_READY --> SIGNED: Подписание договора ПЭП (СМС)
    OFFER_READY --> REJECTED: Клиент отказался от предложения
    
    SIGNED --> DISBURSED: Зачисление средств на расчетный счет
    DISBURSED --> [*]
    REJECTED --> [*]
```

---

## 3. Модель данных (Entity Relationship)

```mermaid
erDiagram
    COMPANY ||--o{ APPLICATION : "подает"
    CREDIT_PRODUCT ||--o{ APPLICATION : "выбирается для"
    APPLICATION ||--o| SCORING_RESULT : "оценивается"
    APPLICATION ||--o{ APPLICATION_AUDIT_LOG : "содержит историю"
    APPLICATION ||--o{ APPLICATION_DOCUMENT : "включает"

    COMPANY {
        uuid id PK
        string inn UK
        string name
        string legal_form
        date registration_date
        float annual_revenue
        float net_profit
        int bki_score
        float existing_debt
        float monthly_debt_payment
        boolean has_account_in_alfa
    }

    CREDIT_PRODUCT {
        string id PK
        string name
        float min_amount
        float max_amount
        int min_term_months
        int max_term_months
        float base_interest_rate
        boolean requires_collateral
    }

    APPLICATION {
        uuid id PK
        string application_number UK
        uuid company_id FK
        string product_id FK
        float requested_amount
        int requested_term_months
        string status
        float approved_amount
        int approved_term_months
        float approved_rate
        float monthly_payment
        boolean is_counter_offer
        string counter_offer_reason
        string sms_code
    }

    SCORING_RESULT {
        uuid id PK
        uuid application_id FK
        int total_score
        string risk_level
        string recommended_decision
        float max_approved_amount
        float recommended_rate
        float dti
        json factors
        json stop_factors
        json recommendations
    }

    APPLICATION_AUDIT_LOG {
        uuid id PK
        uuid application_id FK
        string from_status
        string to_status
        string actor_role
        string comment
        datetime created_at
    }
```

---

## 4. Логика скоринга и матрица кредитных решений

### Весовые категории скоринговой модели (0 - 1000 баллов):
1. **Возраст бизнеса (20% веса):**
   * $\ge$ 3 лет: `+100 баллов`
   * 1 - 3 года: `+60 баллов`
   * $<$ 1 года: `-40 баллов`
   * $<$ 6 месяцев: **СТОП-ФАКТОР (Отказ)**
2. **Кредитная история БКИ (25% веса):**
   * БКИ $\ge$ 750: `+160 баллов`
   * БКИ 640 - 749: `+80 баллов`
   * БКИ 550 - 639: `+20 баллов`
   * БКИ $<$ 500: **СТОП-ФАКТОР (Отказ)**
3. **Объем финансирования к выручке (20% веса):**
   * $\le$ 20%: `+100 баллов`
   * 20 - 40%: `+40 баллов`
   * $>$ 40%: `-80 баллов`
4. **Коэффициент долговой нагрузки DTI (20% веса):**
   * DTI $\le$ 35%: `+100 баллов`
   * DTI 35 - 50%: `+30 баллов`
   * DTI $>$ 50%: `-100 баллов`
5. **Клиентская лояльность (10% веса):**
   * Расчетный счет открыт в Альфа-Банке: `+60 баллов` и **скидка -0.5% к ставке**
6. **Судебная и налоговая нагрузка (5% веса):**
   * Задолженность перед ФНС: `-60 баллов`
   * Арбитражные дела: `-40 баллов` за каждое дело

### Дерево решений:
* **Стоп-факторы или скор < 450** $\rightarrow$ `REJECT` (Отказ + персональные рекомендации «Кредитного доктора»).
* **Наличие налоговой задолженности или $\ge 2$ судебных исков** $\rightarrow$ `MANUAL_REVIEW` (Передача кредитному андеррайтеру).
* **Сумма превышает безопасный лимит или DTI > 45%** $\rightarrow$ `COUNTER_OFFER` (Встречное предложение с безопасной суммой).
* **Скор $\ge$ 700 и DTI $\le$ 45%** $\rightarrow$ `APPROVE` (Мгновенное автоодобрение на запрошенных условиях).
