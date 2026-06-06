package utils

import (
	"crypto/rand"
	"math/big"
	"strings"
)

const charset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

func GenerateShortCode(length int) string {
	b := make([]byte, length)
	for i := range b {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			b[i] = charset[0]
		} else {
			b[i] = charset[num.Int64()]
		}
	}
	return string(b)
}

func GenerateOrderNo() string {
	return "YX" + strings.ToUpper(GenerateShortCode(8))
}
