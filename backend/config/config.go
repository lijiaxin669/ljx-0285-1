package config

import (
	"os"
)

type Config struct {
	MongoURI   string
	MongoDB    string
	ServerPort string
}

func Load() *Config {
	return &Config{
		MongoURI:   getEnv("MONGO_URI", "mongodb://admin:password123@localhost:27017/yuexing?authSource=admin"),
		MongoDB:    getEnv("MONGO_DB", "yuexing"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
