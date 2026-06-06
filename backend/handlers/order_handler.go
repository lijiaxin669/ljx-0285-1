package handlers

import (
	"context"
	"math"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"yuexing-backend/db"
	"yuexing-backend/models"
	"yuexing-backend/utils"
)

const LateFeeRate = 0.01

type CreateOrderRequest struct {
	SKUID         string `json:"skuId" binding:"required"`
	CustomerName  string `json:"customerName" binding:"required"`
	CustomerPhone string `json:"customerPhone" binding:"required"`
	StoreID       string `json:"storeId" binding:"required"`
	RentalDays    int    `json:"rentalDays" binding:"required,min=1"`
}

func ListOrders(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	status := c.Query("status")
	phone := c.Query("phone")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}
	if phone != "" {
		filter["customerPhone"] = bson.M{"$regex": phone}
	}

	skip := (page - 1) * limit

	opts := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(limit)).
		SetSort(bson.M{"createdAt": -1})

	col := db.Collection("orders")
	cursor, err := col.Find(ctx, filter, opts)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	defer cursor.Close(ctx)

	var orders []models.Order
	if err := cursor.All(ctx, &orders); err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	for i := range orders {
		calculateOverdue(&orders[i])
	}

	total, _ := col.CountDocuments(ctx, filter)

	utils.Success(c, gin.H{
		"items": orders,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func GetOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid Order ID")
		return
	}

	var order models.Order
	col := db.Collection("orders")
	if err := col.FindOne(ctx, bson.M{"_id": id}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	calculateOverdue(&order)
	order.SKU = getSKUByID(ctx, order.SKUID)
	order.Store = getStoreByID(ctx, order.StoreID)

	utils.Success(c, order)
}

func GetOrderByShortCode(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	shortCode := c.Param("shortCode")

	var order models.Order
	col := db.Collection("orders")
	if err := col.FindOne(ctx, bson.M{"shortCode": shortCode}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	calculateOverdue(&order)
	order.SKU = getSKUByID(ctx, order.SKUID)
	order.Store = getStoreByID(ctx, order.StoreID)

	utils.Success(c, order)
}

func CalculatePrice(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	skuID := c.Query("skuId")
	rentalDays, _ := strconv.Atoi(c.Query("rentalDays"))

	if skuID == "" || rentalDays < 1 {
		utils.BadRequest(c, "skuId and rentalDays are required")
		return
	}

	id, err := primitive.ObjectIDFromHex(skuID)
	if err != nil {
		utils.BadRequest(c, "Invalid SKU ID")
		return
	}

	var sku models.SKU
	col := db.Collection("skus")
	if err := col.FindOne(ctx, bson.M{"_id": id}).Decode(&sku); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "SKU not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	total := float64(rentalDays) * sku.DailyRate
	deposit := sku.Deposit

	utils.Success(c, gin.H{
		"dailyRate":  sku.DailyRate,
		"rentalDays": rentalDays,
		"total":      total,
		"deposit":    deposit,
		"amountDue":  total + deposit,
	})
}

func CreateOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	skuID, err := primitive.ObjectIDFromHex(req.SKUID)
	if err != nil {
		utils.BadRequest(c, "Invalid SKU ID")
		return
	}

	storeID, err := primitive.ObjectIDFromHex(req.StoreID)
	if err != nil {
		utils.BadRequest(c, "Invalid Store ID")
		return
	}

	var sku models.SKU
	skuCol := db.Collection("skus")
	if err := skuCol.FindOne(ctx, bson.M{"_id": skuID}).Decode(&sku); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "SKU not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	if sku.Available <= 0 {
		utils.BadRequest(c, "Out of stock")
		return
	}

	var store models.Store
	storeCol := db.Collection("stores")
	if err := storeCol.FindOne(ctx, bson.M{"_id": storeID}).Decode(&store); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Store not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	shortCode := utils.GenerateShortCode(6)
	orderCol := db.Collection("orders")
	for {
		count, _ := orderCol.CountDocuments(ctx, bson.M{"shortCode": shortCode})
		if count == 0 {
			break
		}
		shortCode = utils.GenerateShortCode(6)
	}

	startDate := time.Now()
	expectedEndDate := startDate.AddDate(0, 0, req.RentalDays)
	totalAmount := float64(req.RentalDays) * sku.DailyRate

	order := models.Order{
		ID:              primitive.NewObjectID(),
		OrderNo:         utils.GenerateOrderNo(),
		ShortCode:       shortCode,
		SKUID:           skuID,
		CustomerName:    req.CustomerName,
		CustomerPhone:   req.CustomerPhone,
		StoreID:         storeID,
		RentalDays:      req.RentalDays,
		DailyRate:       sku.DailyRate,
		TotalAmount:     totalAmount,
		Deposit:         sku.Deposit,
		Status:          models.OrderStatusPending,
		StartDate:       startDate,
		ExpectedEndDate: expectedEndDate,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	update := bson.M{"$inc": bson.M{"available": -1}}
	result, err := skuCol.UpdateOne(ctx, bson.M{"_id": skuID, "available": bson.M{"$gt": 0}}, update)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	if result.ModifiedCount == 0 {
		utils.BadRequest(c, "Out of stock")
		return
	}

	_, err = orderCol.InsertOne(ctx, order)
	if err != nil {
		_, rollbackErr := skuCol.UpdateOne(ctx, bson.M{"_id": skuID}, bson.M{"$inc": bson.M{"available": 1}})
		if rollbackErr != nil {
			utils.InternalError(c, "Failed to create order and rollback stock: "+err.Error())
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	order.SKU = &sku
	order.Store = &store

	utils.Success(c, order)
}



func CancelOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid Order ID")
		return
	}

	orderCol := db.Collection("orders")
	var order models.Order
	if err := orderCol.FindOne(ctx, bson.M{"_id": id}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	if order.Status != models.OrderStatusPending {
		utils.BadRequest(c, "Only pending orders can be cancelled")
		return
	}

	if order.PickedUpAt != nil {
		utils.BadRequest(c, "Order already picked up, cannot cancel")
		return
	}

	skuCol := db.Collection("skus")
	_, err = skuCol.UpdateOne(ctx, bson.M{"_id": order.SKUID}, bson.M{"$inc": bson.M{"available": 1}})
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	update := bson.M{
		"$set": bson.M{
			"status":    models.OrderStatusCancelled,
			"updatedAt": time.Now(),
		},
	}
	_, err = orderCol.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		_, rollbackErr := skuCol.UpdateOne(ctx, bson.M{"_id": order.SKUID}, bson.M{"$inc": bson.M{"available": -1}})
		if rollbackErr != nil {
			utils.InternalError(c, "Failed to cancel order and rollback stock: "+err.Error())
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	order.Status = models.OrderStatusCancelled
	utils.Success(c, order)
}

func PayOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var req models.PaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	id, err := primitive.ObjectIDFromHex(req.OrderID)
	if err != nil {
		utils.BadRequest(c, "Invalid Order ID")
		return
	}

	orderCol := db.Collection("orders")
	var order models.Order
	if err := orderCol.FindOne(ctx, bson.M{"_id": id}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	if order.Status != models.OrderStatusPending {
		utils.BadRequest(c, "Only pending orders can be paid")
		return
	}

	update := bson.M{
		"$set": bson.M{
			"status":    models.OrderStatusPaid,
			"updatedAt": time.Now(),
		},
	}
	_, err = orderCol.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	order.Status = models.OrderStatusPaid
	utils.Success(c, models.PaymentResponse{
		Success: true,
		Message: "Payment successful (Mock)",
	})
}

func PickupOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var req models.PickupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	id, err := primitive.ObjectIDFromHex(req.OrderID)
	if err != nil {
		utils.BadRequest(c, "Invalid Order ID")
		return
	}

	orderCol := db.Collection("orders")
	var order models.Order
	if err := orderCol.FindOne(ctx, bson.M{"_id": id}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	if order.Status != models.OrderStatusPaid {
		utils.BadRequest(c, "Only paid orders can be picked up")
		return
	}

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"status":     models.OrderStatusPickedUp,
			"pickedUpAt": now,
			"updatedAt":  now,
		},
	}
	_, err = orderCol.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	order.Status = models.OrderStatusPickedUp
	order.PickedUpAt = &now
	utils.Success(c, order)
}

func ReturnOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var req models.ReturnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	id, err := primitive.ObjectIDFromHex(req.OrderID)
	if err != nil {
		utils.BadRequest(c, "Invalid Order ID")
		return
	}

	orderCol := db.Collection("orders")
	var order models.Order
	if err := orderCol.FindOne(ctx, bson.M{"_id": id}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	if order.Status != models.OrderStatusPickedUp && order.Status != models.OrderStatusOverdue {
		utils.BadRequest(c, "Only picked up or overdue orders can be returned")
		return
	}

	calculateOverdue(&order)

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"status":      models.OrderStatusReturned,
			"returnedAt":  now,
			"overdueDays": order.OverdueDays,
			"lateFee":     order.LateFee,
			"remark":      req.Remark,
			"updatedAt":   now,
		},
	}
	_, err = orderCol.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	order.Status = models.OrderStatusReturned
	order.ReturnedAt = &now
	utils.Success(c, order)
}

func InspectOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var req models.InspectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	id, err := primitive.ObjectIDFromHex(req.OrderID)
	if err != nil {
		utils.BadRequest(c, "Invalid Order ID")
		return
	}

	orderCol := db.Collection("orders")
	var order models.Order
	if err := orderCol.FindOne(ctx, bson.M{"_id": id}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	if order.Status != models.OrderStatusReturned {
		utils.BadRequest(c, "Only returned orders can be inspected")
		return
	}

	if order.ReturnedAt != nil {
		sinceReturn := time.Since(*order.ReturnedAt)
		if sinceReturn > 24*time.Hour {
			utils.BadRequest(c, "Inspection must be within 24 hours of return")
			return
		}
	}

	if !req.Pass {
		utils.BadRequest(c, "Inspection failed, please handle manually")
		return
	}

	skuCol := db.Collection("skus")
	_, err = skuCol.UpdateOne(ctx, bson.M{"_id": order.SKUID}, bson.M{"$inc": bson.M{"available": 1}})
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"status":      models.OrderStatusCompleted,
			"inspectedAt": now,
			"remark":      req.Remark,
			"updatedAt":   now,
		},
	}
	_, err = orderCol.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		_, rollbackErr := skuCol.UpdateOne(ctx, bson.M{"_id": order.SKUID}, bson.M{"$inc": bson.M{"available": -1}})
		if rollbackErr != nil {
			utils.InternalError(c, "Failed to inspect order and rollback stock: "+err.Error())
			return
		}
		utils.InternalError(c, err.Error())
		return
	}
	order.Status = models.OrderStatusCompleted
	order.InspectedAt = &now
	utils.Success(c, order)
}

func ScanUpdateOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var req models.ScanUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	orderCol := db.Collection("orders")
	var order models.Order
	if err := orderCol.FindOne(ctx, bson.M{"shortCode": req.ShortCode}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	orderIDHex := order.ID.Hex()

	switch req.Action {
	case "pickup":
		c.Request.Body = nil
		c.Set("orderId", orderIDHex)
		PickupOrder(c)
	case "return":
		c.Request.Body = nil
		c.Set("orderId", orderIDHex)
		ReturnOrder(c)
	case "inspect":
		c.Request.Body = nil
		c.Set("orderId", orderIDHex)
		req := models.InspectRequest{OrderID: orderIDHex, Pass: true}
		c.Set("body", req)
		InspectOrder(c)
	default:
		utils.BadRequest(c, "Invalid action")
	}
}

func calculateOverdue(order *models.Order) {
	if order.Status == models.OrderStatusPickedUp || order.Status == models.OrderStatusOverdue {
		now := time.Now()
		if now.After(order.ExpectedEndDate) {
			days := int(math.Ceil(time.Until(order.ExpectedEndDate).Hours() / -24))
			order.OverdueDays = days
			order.LateFee = order.TotalAmount * LateFeeRate * float64(days)
			if order.Status == models.OrderStatusPickedUp {
				order.Status = models.OrderStatusOverdue
			}
		}
	}
}

func getSKUByID(ctx context.Context, id primitive.ObjectID) *models.SKU {
	var sku models.SKU
	col := db.Collection("skus")
	if err := col.FindOne(ctx, bson.M{"_id": id}).Decode(&sku); err != nil {
		return nil
	}
	return &sku
}

func getStoreByID(ctx context.Context, id primitive.ObjectID) *models.Store {
	var store models.Store
	col := db.Collection("stores")
	if err := col.FindOne(ctx, bson.M{"_id": id}).Decode(&store); err != nil {
		return nil
	}
	return &store
}

func ScanUpdateOrderByShortCode(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var req models.ScanUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	orderCol := db.Collection("orders")
	var order models.Order
	if err := orderCol.FindOne(ctx, bson.M{"shortCode": req.ShortCode}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	switch req.Action {
	case "pickup":
		if order.Status != models.OrderStatusPaid {
			utils.BadRequest(c, "Only paid orders can be picked up")
			return
		}
		now := time.Now()
		update := bson.M{
			"$set": bson.M{
				"status":     models.OrderStatusPickedUp,
				"pickedUpAt": now,
				"updatedAt":  now,
			},
		}
		_, err := orderCol.UpdateOne(ctx, bson.M{"_id": order.ID}, update)
		if err != nil {
			utils.InternalError(c, err.Error())
			return
		}
		order.Status = models.OrderStatusPickedUp
		order.PickedUpAt = &now
		utils.Success(c, order)

	case "return":
		if order.Status != models.OrderStatusPickedUp && order.Status != models.OrderStatusOverdue {
			utils.BadRequest(c, "Only picked up or overdue orders can be returned")
			return
		}
		calculateOverdue(&order)
		now := time.Now()
		update := bson.M{
			"$set": bson.M{
				"status":      models.OrderStatusReturned,
				"returnedAt":  now,
				"overdueDays": order.OverdueDays,
				"lateFee":     order.LateFee,
				"updatedAt":   now,
			},
		}
		_, err := orderCol.UpdateOne(ctx, bson.M{"_id": order.ID}, update)
		if err != nil {
			utils.InternalError(c, err.Error())
			return
		}
		order.Status = models.OrderStatusReturned
		order.ReturnedAt = &now
		utils.Success(c, order)

	case "inspect":
		if order.Status != models.OrderStatusReturned {
			utils.BadRequest(c, "Only returned orders can be inspected")
			return
		}
		if order.ReturnedAt != nil {
			sinceReturn := time.Since(*order.ReturnedAt)
			if sinceReturn > 24*time.Hour {
				utils.BadRequest(c, "Inspection must be within 24 hours of return")
				return
			}
		}

		skuCol := db.Collection("skus")
		_, err := skuCol.UpdateOne(ctx, bson.M{"_id": order.SKUID}, bson.M{"$inc": bson.M{"available": 1}})
		if err != nil {
			utils.InternalError(c, err.Error())
			return
		}

		now := time.Now()
		update := bson.M{
			"$set": bson.M{
				"status":      models.OrderStatusCompleted,
				"inspectedAt": now,
				"updatedAt":   now,
			},
		}
		_, err = orderCol.UpdateOne(ctx, bson.M{"_id": order.ID}, update)
		if err != nil {
			_, rollbackErr := skuCol.UpdateOne(ctx, bson.M{"_id": order.SKUID}, bson.M{"$inc": bson.M{"available": -1}})
			if rollbackErr != nil {
				utils.InternalError(c, "Failed to inspect order and rollback stock: "+err.Error())
				return
			}
			utils.InternalError(c, err.Error())
			return
		}

		order.Status = models.OrderStatusCompleted
		order.InspectedAt = &now
		utils.Success(c, order)

	default:
		utils.BadRequest(c, "Invalid action. Must be pickup, return, or inspect")
	}
}

func ExtendOrderPreview(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid Order ID")
		return
	}

	var req models.ExtendPreviewRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	var order models.Order
	orderCol := db.Collection("orders")
	if err := orderCol.FindOne(ctx, bson.M{"_id": id}).Decode(&order); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "Order not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	if order.Status != models.OrderStatusPickedUp {
		utils.BadRequest(c, "Only picked up orders can be extended")
		return
	}

	if order.ExtensionCount >= 2 {
		utils.BadRequest(c, "Maximum 2 extensions allowed per order")
		return
	}

	daysUntilEnd := int(time.Until(order.ExpectedEndDate).Hours() / 24)
	if daysUntilEnd < 1 {
		utils.BadRequest(c, "Extension must be requested at least 1 day before expected return date")
		return
	}

	additionalFee := float64(req.AdditionalDays) * order.DailyRate
	newEndDate := order.ExpectedEndDate.AddDate(0, 0, req.AdditionalDays)

	preview := models.ExtendPreviewResponse{
		AdditionalDays:     req.AdditionalDays,
		AdditionalFee:      additionalFee,
		CurrentTotalAmount: order.TotalAmount,
		NewTotalAmount:     order.TotalAmount + additionalFee,
		CurrentRentalDays:  order.RentalDays,
		NewRentalDays:      order.RentalDays + req.AdditionalDays,
		PreviousEndDate:    order.ExpectedEndDate,
		NewEndDate:         newEndDate,
		DailyRate:          order.DailyRate,
	}

	utils.Success(c, preview)
}

func ExtendOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid Order ID")
		return
	}

	var req models.ExtendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	orderCol := db.Collection("orders")
	session, err := db.GetClient().StartSession()
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	defer session.EndSession(ctx)

	var order models.Order
	var extension models.OrderExtension

	_, err = session.WithTransaction(ctx, func(sessCtx mongo.SessionContext) (interface{}, error) {
		if err := orderCol.FindOne(sessCtx, bson.M{"_id": id}).Decode(&order); err != nil {
			return nil, err
		}

		if order.Status != models.OrderStatusPickedUp {
			return nil, utils.NewValidationError("Only picked up orders can be extended")
		}

		if order.ExtensionCount >= 2 {
			return nil, utils.NewValidationError("Maximum 2 extensions allowed per order")
		}

		daysUntilEnd := int(time.Until(order.ExpectedEndDate).Hours() / 24)
		if daysUntilEnd < 1 {
			return nil, utils.NewValidationError("Extension must be requested at least 1 day before expected return date")
		}

		additionalFee := float64(req.AdditionalDays) * order.DailyRate
		newEndDate := order.ExpectedEndDate.AddDate(0, 0, req.AdditionalDays)
		now := time.Now()

		extension = models.OrderExtension{
			AdditionalDays:  req.AdditionalDays,
			Fee:             additionalFee,
			PaidAt:          now,
			PreviousEndDate: order.ExpectedEndDate,
			NewEndDate:      newEndDate,
		}

		order.ExtensionCount++
		order.RentalDays += req.AdditionalDays
		order.TotalAmount += additionalFee
		order.ExpectedEndDate = newEndDate
		order.UpdatedAt = now

		if _, err := orderCol.UpdateOne(sessCtx, bson.M{"_id": id}, bson.M{
			"$set": bson.M{
				"extensionCount":  order.ExtensionCount,
				"rentalDays":      order.RentalDays,
				"totalAmount":     order.TotalAmount,
				"expectedEndDate": order.ExpectedEndDate,
				"updatedAt":       order.UpdatedAt,
			},
			"$push": bson.M{
				"extensions": extension,
			},
		}); err != nil {
			return nil, err
		}

		return nil, nil
	})

	if err != nil {
		if verr, ok := err.(*utils.ValidationError); ok {
			utils.BadRequest(c, verr.Error())
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	order.SKU = getSKUByID(ctx, order.SKUID)
	order.Store = getStoreByID(ctx, order.StoreID)

	utils.Success(c, models.ExtendPaymentResponse{
		Success: true,
		Message: "Extension payment successful (Mock)",
	})
}
