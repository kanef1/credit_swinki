# Multi-stage build для Go бэкенда
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Установка зависимостей сборки
RUN apk add --no-cache git ca-certificates

# Копирование файлов модулей
COPY go.mod go.sum ./
RUN go mod download

# Копирование исходного кода
COPY . .

# Сборка статически слинкованного бинарника
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server cmd/server/main.go

# Финальный легковесный образ
FROM alpine:3.20

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

COPY --from=builder /app/server /app/server
COPY --from=builder /app/docs /app/docs

ENV PORT=8080
EXPOSE 8080

CMD ["/app/server"]
