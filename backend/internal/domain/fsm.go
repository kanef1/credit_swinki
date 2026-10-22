package domain

import (
	"fmt"
)

// AllowedTransitions определяет граф допустимых переходов конечного автомата заявки
var AllowedTransitions = map[ApplicationStatus][]ApplicationStatus{
	StatusDraft: {
		StatusSubmitted,
	},
	StatusSubmitted: {
		StatusEnriching,
	},
	StatusEnriching: {
		StatusScoring,
		StatusRejected,
	},
	StatusScoring: {
		StatusOfferReady,
		StatusManualReview,
		StatusRejected,
	},
	StatusManualReview: {
		StatusOfferReady,
		StatusRejected,
	},
	StatusOfferReady: {
		StatusSigned,
		StatusRejected,
	},
	StatusSigned: {
		StatusDisbursed,
	},
	StatusDisbursed: {},
	StatusRejected:  {},
}

// CanTransition проверяет валидность смены статуса согласно FSM
func CanTransition(from, to ApplicationStatus) bool {
	allowed, exists := AllowedTransitions[from]
	if !exists {
		return false
	}
	for _, target := range allowed {
		if target == to {
			return true
		}
	}
	return false
}

// ValidateTransition возвращает ошибку, если переход недопустим
func ValidateTransition(from, to ApplicationStatus) error {
	if !CanTransition(from, to) {
		return fmt.Errorf("недопустимый переход конвейера: из '%s' в '%s'", from, to)
	}
	return nil
}
