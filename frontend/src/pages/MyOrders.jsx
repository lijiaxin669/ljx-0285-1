import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { orderApi } from '../api';

const statusNames = {
  pending: '待支付',
  paid: '已支付',
  picked_up: '已取货',
  returned: '已归还',
  inspected: '已质检',
  completed: '已完成',
  cancelled: '已取消',
  overdue: '已逾期',
};

const categoryNames = {
  string: '弦乐',
  wind: '管乐',
  percussion: '打击',
  keyboard: '键盘',
  electronic: '电子',
};

function MyOrders() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-orders', phone],
    queryFn: () => orderApi.getOrders({ phone, limit: 50 }),
    enabled: !!phone,
  });

  const payMutation = useMutation({
    mutationFn: (orderId) => orderApi.payOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-orders', phone]);
      setMessage({ type: 'success', text: '支付成功！请到门店取货' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '支付失败' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId) => orderApi.cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-orders', phone]);
      setMessage({ type: 'success', text: '订单已取消' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '取消失败' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const orders = data?.data?.items || [];

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>我的订单</h2>

      <div className="filters" style={{ marginBottom: 20 }}>
        <div className="filter-row">
          <div className="filter-group">
            <label>手机号:</label>
            <input
              type="tel"
              placeholder="输入手机号查询订单"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: 200 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => refetch()}>
            查询
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {!phone ? (
        <div className="loading">请输入手机号查询您的订单</div>
      ) : isLoading ? (
        <div className="loading">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="loading">暂无订单</div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div>
                  <span className="order-no">{order.orderNo}</span>
                  <span className="short-code" style={{ marginLeft: 12 }}>
                    短码: {order.shortCode}
                  </span>
                </div>
                <span className={`status-badge status-${order.status}`}>
                  {statusNames[order.status]}
                </span>
              </div>
              
              <div className="order-info">
                {order.sku && (
                  <>
                    <span className="store-badge">
                      {categoryNames[order.sku.category]}
                    </span>
                    <span>{order.sku.name}</span>
                  </>
                )}
                <span>租期: {order.rentalDays} 天</span>
                <span>租金: ¥{order.totalAmount.toFixed(2)}</span>
                <span>押金: ¥{order.deposit.toFixed(2)}</span>
                {order.overdueDays > 0 && (
                  <span className="late-fee">
                    逾期 {order.overdueDays} 天 · 滞纳金 ¥{order.lateFee.toFixed(2)}
                  </span>
                )}
              </div>

              <div className="order-info" style={{ marginTop: 8 }}>
                <span>客户: {order.customerName} ({order.customerPhone})</span>
                <span>下单: {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                {order.pickedUpAt && (
                  <span>取货: {dayjs(order.pickedUpAt).format('YYYY-MM-DD HH:mm')}</span>
                )}
                {order.returnedAt && (
                  <span>归还: {dayjs(order.returnedAt).format('YYYY-MM-DD HH:mm')}</span>
                )}
              </div>

              {order.store && (
                <div className="order-info" style={{ marginTop: 8 }}>
                  <span>门店: {order.store.name} - {order.store.address}</span>
                </div>
              )}

              <div className="order-actions">
                {order.status === 'pending' && (
                  <>
                    <button
                      className="btn btn-success"
                      onClick={() => payMutation.mutate(order.id)}
                      disabled={payMutation.isLoading}
                    >
                      {payMutation.isLoading ? '支付中...' : '支付'}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        if (window.confirm('确定要取消订单吗？')) {
                          cancelMutation.mutate(order.id);
                        }
                      }}
                      disabled={cancelMutation.isLoading}
                    >
                      {cancelMutation.isLoading ? '取消中...' : '取消订单'}
                    </button>
                  </>
                )}
                {order.status === 'paid' && (
                  <div className="alert alert-info">
                    请在 {dayjs(order.startDate).format('YYYY-MM-DD')} 后到门店取货
                  </div>
                )}
                {order.status === 'picked_up' && (
                  <div className="alert alert-info">
                    请在 {dayjs(order.expectedEndDate).format('YYYY-MM-DD')} 前归还
                  </div>
                )}
                {order.status === 'completed' && (
                  <div className="alert alert-success">
                    订单已完成，押金将原路退回
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyOrders;
