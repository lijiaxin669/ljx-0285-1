import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { skuApi, storeApi, orderApi } from '../api';

const categoryNames = {
  string: '弦乐',
  wind: '管乐',
  percussion: '打击',
  keyboard: '键盘',
  electronic: '电子',
};

const categoryEmojis = {
  string: '🎸',
  wind: '🎺',
  percussion: '🥁',
  keyboard: '🎹',
  electronic: '🎛️',
};

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [rentalDays, setRentalDays] = useState(7);
  const [storeId, setStoreId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [message, setMessage] = useState(null);

  const { data: skuData, isLoading: skuLoading } = useQuery({
    queryKey: ['sku', id],
    queryFn: () => skuApi.getSKU(id),
  });

  const { data: storesData } = useQuery({
    queryKey: ['stores'],
    queryFn: () => storeApi.getStores(),
  });

  const { data: priceData } = useQuery({
    queryKey: ['price', id, rentalDays],
    queryFn: () => skuApi.calculatePrice(id, rentalDays),
    enabled: !!id && rentalDays >= 1,
  });

  useEffect(() => {
    if (storesData?.data?.length > 0 && !storeId) {
      setStoreId(storesData.data[0].id);
    }
  }, [storesData, storeId]);

  const createOrderMutation = useMutation({
    mutationFn: (data) => orderApi.createOrder(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['skus']);
      queryClient.invalidateQueries(['sku', id]);
      setMessage({ type: 'success', text: `订单创建成功！订单号: ${response.data.orderNo}，短码: ${response.data.shortCode}` });
      setTimeout(() => navigate('/orders'), 2000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message || error.error || '创建订单失败' });
    },
  });

  const sku = skuData?.data;
  const price = priceData?.data;
  const stores = storesData?.data || [];

  if (skuLoading) return <div className="loading">加载中...</div>;
  if (!sku) return <div className="loading">商品不存在</div>;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !storeId) {
      setMessage({ type: 'error', text: '请填写完整信息' });
      return;
    }
    createOrderMutation.mutate({
      skuId: id,
      customerName,
      customerPhone,
      storeId,
      rentalDays,
    });
  };

  return (
    <div className="detail-page">
      <div className="detail-card">
        <div className="detail-image">
          {categoryEmojis[sku.category] || '🎵'}
        </div>
        <span className="sku-category">{categoryNames[sku.category]}</span>
        <h2 className="detail-name">{sku.name}</h2>
        <p className="detail-brand">{sku.brand} · {sku.model}</p>
        <p className="detail-desc">{sku.description}</p>
        
        <div className="price-section">
          <div className="price-row">
            <span>日租金</span>
            <span>¥{sku.dailyRate.toFixed(2)}</span>
          </div>
          <div className="price-row">
            <span>押金</span>
            <span>¥{sku.deposit.toFixed(2)}</span>
          </div>
          <div className="price-row">
            <span>总库存</span>
            <span>{sku.totalStock} 件</span>
          </div>
          <div className="price-row">
            <span>可租数量</span>
            <span className={sku.available > 0 ? '' : 'late-fee'}>
              {sku.available} 件
            </span>
          </div>
        </div>
      </div>

      <div className="detail-card">
        <h3 style={{ marginBottom: 20 }}>租赁计算器</h3>
        
        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>租期 (天)</label>
            <input
              type="number"
              min="1"
              max="365"
              value={rentalDays}
              onChange={(e) => setRentalDays(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          {price && (
            <div className="price-section">
              <div className="price-row">
                <span>日租金 × {rentalDays} 天</span>
                <span>¥{price.dailyRate.toFixed(2)} × {rentalDays}</span>
              </div>
              <div className="price-row">
                <span>租金小计</span>
                <span>¥{price.total.toFixed(2)}</span>
              </div>
              <div className="price-row">
                <span>押金</span>
                <span>¥{price.deposit.toFixed(2)}</span>
              </div>
              <div className="price-row total">
                <span>应付金额</span>
                <span>¥{price.amountDue.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>取还门店</label>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">请选择门店</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} - {store.address}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>姓名</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="请输入您的姓名"
            />
          </div>

          <div className="form-group">
            <label>手机号</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="请输入手机号"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 10 }}
            disabled={sku.available <= 0 || createOrderMutation.isLoading}
          >
            {createOrderMutation.isLoading ? '创建中...' : 
             sku.available <= 0 ? '暂无库存' : '提交订单'}
          </button>

          <p style={{ color: '#999', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            提交后需支付，然后到门店取货
          </p>
        </form>
      </div>
    </div>
  );
}

export default ProductDetail;
