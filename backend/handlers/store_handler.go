package handlers

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"yuexing-backend/db"
	"yuexing-backend/models"
	"yuexing-backend/utils"
)

func ListStores(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	col := db.Collection("stores")
	cursor, err := col.Find(ctx, bson.M{})
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	defer cursor.Close(ctx)

	var stores []models.Store
	if err := cursor.All(ctx, &stores); err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, stores)
}

func GetStore(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid Store ID")
		return
	}

	var store models.Store
	col := db.Collection("stores")
	if err := col.FindOne(ctx, bson.M{"_id": id}).Decode(&store); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Store not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, store)
}

func CreateStore(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var store models.Store
	if err := c.ShouldBindJSON(&store); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	store.ID = primitive.NewObjectID()
	store.CreatedAt = time.Now()
	store.UpdatedAt = time.Now()

	col := db.Collection("stores")
	_, err := col.InsertOne(ctx, store)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, store)
}
