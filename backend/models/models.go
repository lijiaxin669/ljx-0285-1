package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type InstrumentCategory string

const (
	CategoryString   InstrumentCategory = "string"
	CategoryWind     InstrumentCategory = "wind"
	CategoryPercussion InstrumentCategory = "percussion"
	CategoryKeyboard InstrumentCategory = "keyboard"
	CategoryElectronic InstrumentCategory = "electronic"
)

type SKU struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string             `bson:"name" json:"name" binding:"required"`
	Category    InstrumentCategory `bson:"category" json:"category" binding:"required,oneof=string wind percussion keyboard electronic"`
	Brand       string             `bson:"brand" json:"brand" binding:"required"`
	Model       string             `bson:"model" json:"model" binding:"required"`
	Description string             `bson:"description" json:"description"`
	DailyRate   float64            `bson:"dailyRate" json:"dailyRate" binding:"required,min=0"`
	Deposit     float64            `bson:"deposit" json:"deposit" binding:"required,min=0"`
	TotalStock  int                `bson:"totalStock" json:"totalStock" binding:"required,min=0"`
	Available   int                `bson:"available" json:"available" binding:"min=0"`
	ImageURL    string             `bson:"imageUrl" json:"imageUrl"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusPaid       OrderStatus = "paid"
	OrderStatusPickedUp   OrderStatus = "picked_up"
	OrderStatusReturned   OrderStatus = "returned"
	OrderStatusInspected  OrderStatus = "inspected"
	OrderStatusCompleted  OrderStatus = "completed"
	OrderStatusCancelled  OrderStatus = "cancelled"
	OrderStatusOverdue    OrderStatus = "overdue"
)

type Order struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	OrderNo          string             `bson:"orderNo" json:"orderNo"`
	ShortCode        string             `bson:"shortCode" json:"shortCode"`
	SKUID            primitive.ObjectID `bson:"skuId" json:"skuId"`
	SKU              *SKU               `bson:"sku,omitempty" json:"sku,omitempty"`
	CustomerName     string             `bson:"customerName" json:"customerName" binding:"required"`
	CustomerPhone    string             `bson:"customerPhone" json:"customerPhone" binding:"required"`
	StoreID          primitive.ObjectID `bson:"storeId" json:"storeId"`
	Store            *Store             `bson:"store,omitempty" json:"store,omitempty"`
	RentalDays       int                `bson:"rentalDays" json:"rentalDays" binding:"required,min=1"`
	DailyRate        float64            `bson:"dailyRate" json:"dailyRate"`
	TotalAmount      float64            `bson:"totalAmount" json:"totalAmount"`
	Deposit          float64            `bson:"deposit" json:"deposit"`
	Status           OrderStatus        `bson:"status" json:"status"`
	StartDate        time.Time          `bson:"startDate" json:"startDate"`
	ExpectedEndDate  time.Time         `bson:"expectedEndDate" json:"expectedEndDate"`
	PickedUpAt       *time.Time         `bson:"pickedUpAt,omitempty" json:"pickedUpAt,omitempty"`
	ReturnedAt       *time.Time         `bson:"returnedAt,omitempty" json:"returnedAt,omitempty"`
	InspectedAt      *time.Time         `bson:"inspectedAt,omitempty" json:"inspectedAt,omitempty"`
	OverdueDays      int                `bson:"overdueDays" json:"overdueDays"`
	LateFee          float64            `bson:"lateFee" json:"lateFee"`
	Extensions       []OrderExtension   `bson:"extensions,omitempty" json:"extensions,omitempty"`
	ExtensionCount   int                `bson:"extensionCount" json:"extensionCount"`
	Remark           string             `bson:"remark,omitempty" json:"remark,omitempty"`
	CreatedAt        time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type Store struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name" binding:"required"`
	Address   string             `bson:"address" json:"address" binding:"required"`
	Phone     string             `bson:"phone" json:"phone"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type PaymentRequest struct {
	OrderID string `json:"orderId" binding:"required"`
	Method  string `json:"method" binding:"required"`
}

type PaymentResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type PickupRequest struct {
	OrderID string `json:"orderId" binding:"required"`
}

type ReturnRequest struct {
	OrderID string `json:"orderId" binding:"required"`
	Remark  string `json:"remark"`
}

type InspectRequest struct {
	OrderID string `json:"orderId" binding:"required"`
	Pass    bool   `json:"pass"`
	Remark  string `json:"remark"`
}

type ScanUpdateRequest struct {
	ShortCode string `json:"shortCode" binding:"required"`
	Action    string `json:"action" binding:"required,oneof=pickup return inspect"`
}

type OrderExtension struct {
	AdditionalDays  int       `bson:"additionalDays" json:"additionalDays"`
	Fee             float64   `bson:"fee" json:"fee"`
	PaidAt          time.Time `bson:"paidAt" json:"paidAt"`
	PreviousEndDate time.Time `bson:"previousEndDate" json:"previousEndDate"`
	NewEndDate      time.Time `bson:"newEndDate" json:"newEndDate"`
}

type ExtendPreviewRequest struct {
	AdditionalDays int `form:"additionalDays" binding:"required,min=1,max=14"`
}

type ExtendPreviewResponse struct {
	AdditionalDays     int       `json:"additionalDays"`
	AdditionalFee      float64   `json:"additionalFee"`
	CurrentTotalAmount float64   `json:"currentTotalAmount"`
	NewTotalAmount     float64   `json:"newTotalAmount"`
	CurrentRentalDays  int       `json:"currentRentalDays"`
	NewRentalDays      int       `json:"newRentalDays"`
	PreviousEndDate    time.Time `json:"previousEndDate"`
	NewEndDate         time.Time `json:"newEndDate"`
	DailyRate          float64   `json:"dailyRate"`
}

type ExtendRequest struct {
	AdditionalDays int    `json:"additionalDays" binding:"required,min=1,max=14"`
	Method         string `json:"method" binding:"required"`
}

type ExtendPaymentResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type InventoryLogReason string

const (
	ReasonPurchase  InventoryLogReason = "purchase"
	ReasonDamaged   InventoryLogReason = "damaged"
	ReasonInventory InventoryLogReason = "inventory"
	ReasonOther     InventoryLogReason = "other"
)

var reasonNames = map[InventoryLogReason]string{
	ReasonPurchase:  "采购入库",
	ReasonDamaged:   "损坏报废",
	ReasonInventory: "盘点修正",
	ReasonOther:     "其他",
}

func (r InventoryLogReason) IsValid() bool {
	_, ok := reasonNames[r]
	return ok
}

func (r InventoryLogReason) Name() string {
	if name, ok := reasonNames[r]; ok {
		return name
	}
	return string(r)
}

type InventoryLog struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SKUID           primitive.ObjectID `bson:"skuId" json:"skuId"`
	SKUName         string             `bson:"skuName" json:"skuName"`
	AdjustAmount    int                `bson:"adjustAmount" json:"adjustAmount"`
	BeforeAvailable int               `bson:"beforeAvailable" json:"beforeAvailable"`
	AfterAvailable  int                `bson:"afterAvailable" json:"afterAvailable"`
	Reason          InventoryLogReason `bson:"reason" json:"reason"`
	ReasonName      string             `bson:"reasonName" json:"reasonName"`
	Remark          string             `bson:"remark,omitempty" json:"remark,omitempty"`
	Operator        string             `bson:"operator" json:"operator"`
	CreatedAt       time.Time          `bson:"createdAt" json:"createdAt"`
}

type AdjustStockRequest struct {
	AdjustAmount int                `json:"adjustAmount" binding:"required,ne=0"`
	Reason       InventoryLogReason `json:"reason" binding:"required,oneof=purchase damaged inventory other"`
	Remark       string             `json:"remark"`
}

type AdjustStockResponse struct {
	Success       bool `json:"success"`
	BeforeAvailable int `json:"beforeAvailable"`
	AfterAvailable  int `json:"afterAvailable"`
}
