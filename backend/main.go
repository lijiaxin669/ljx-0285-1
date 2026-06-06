package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"yuexing-backend/config"
	"yuexing-backend/db"
	"yuexing-backend/handlers"
	"yuexing-backend/seed"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	if err := db.Connect(cfg.MongoURI, cfg.MongoDB); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer db.Disconnect()

	if err := seed.Seed(); err != nil {
		log.Printf("Warning: Failed to seed data: %v", err)
	}

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/healthz", handlers.HealthCheck)

	api := r.Group("/api/v1")
	{
		api.GET("/skus/categories", handlers.GetSKUCategories)
		api.GET("/skus", handlers.ListSKUs)
		api.GET("/skus/:id", handlers.GetSKU)
		api.POST("/skus", handlers.CreateSKU)
		api.PUT("/skus/:id", handlers.UpdateSKU)
		api.DELETE("/skus/:id", handlers.DeleteSKU)

		api.GET("/stores", handlers.ListStores)
		api.GET("/stores/:id", handlers.GetStore)
		api.POST("/stores", handlers.CreateStore)

		api.GET("/orders/calculate", handlers.CalculatePrice)
		api.GET("/orders", handlers.ListOrders)
		api.GET("/orders/:id", handlers.GetOrder)
		api.GET("/orders/short/:shortCode", handlers.GetOrderByShortCode)
		api.POST("/orders", handlers.CreateOrder)
		api.POST("/orders/:id/cancel", handlers.CancelOrder)
		api.POST("/orders/pay", handlers.PayOrder)
		api.POST("/orders/pickup", handlers.PickupOrder)
		api.POST("/orders/return", handlers.ReturnOrder)
		api.POST("/orders/inspect", handlers.InspectOrder)
		api.POST("/orders/scan", handlers.ScanUpdateOrderByShortCode)
		api.POST("/orders/:id/extend-preview", handlers.ExtendOrderPreview)
		api.POST("/orders/:id/extend", handlers.ExtendOrder)
		api.POST("/skus/:id/adjust-stock", handlers.AdjustStock)
		api.GET("/inventory-logs", handlers.ListInventoryLogs)
	}

	log.Printf("Server starting on port %s", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
