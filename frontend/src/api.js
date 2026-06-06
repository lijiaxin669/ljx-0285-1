import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error.response?.data || error);
  }
);

export const skuApi = {
  getCategories: () => api.get('/skus/categories'),
  getSKUs: (params) => api.get('/skus', { params }),
  getSKU: (id) => api.get(`/skus/${id}`),
  createSKU: (data) => api.post('/skus', data),
  updateSKU: (id, data) => api.put(`/skus/${id}`, data),
  deleteSKU: (id) => api.delete(`/skus/${id}`),
  adjustStock: (id, data) => api.post(`/skus/${id}/adjust-stock`, data),
  getInventoryLogs: (params) => api.get('/inventory-logs', { params }),
  calculatePrice: (skuId, rentalDays) => 
    api.get('/orders/calculate', { params: { skuId, rentalDays } }),
};

export const storeApi = {
  getStores: () => api.get('/stores'),
  getStore: (id) => api.get(`/stores/${id}`),
};

export const orderApi = {
  getOrders: (params) => api.get('/orders', { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
  getOrderByShortCode: (shortCode) => api.get(`/orders/short/${shortCode}`),
  createOrder: (data) => api.post('/orders', data),
  cancelOrder: (id) => api.post(`/orders/${id}/cancel`),
  payOrder: (orderId, method = 'mock') => 
    api.post('/orders/pay', { orderId, method }),
  pickupOrder: (orderId) => api.post('/orders/pickup', { orderId }),
  returnOrder: (orderId, remark = '') => 
    api.post('/orders/return', { orderId, remark }),
  inspectOrder: (orderId, pass = true, remark = '') => 
    api.post('/orders/inspect', { orderId, pass, remark }),
  scanUpdate: (shortCode, action) => 
    api.post('/orders/scan', { shortCode, action }),
  extendPreview: (orderId, additionalDays) => 
    api.post(`/orders/${orderId}/extend-preview`, null, { params: { additionalDays } }),
  extendOrder: (orderId, additionalDays, method = 'mock') => 
    api.post(`/orders/${orderId}/extend`, { additionalDays, method }),
};

export default api;
