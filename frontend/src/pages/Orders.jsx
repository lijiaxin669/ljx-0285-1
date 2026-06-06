import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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

function Orders() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', status, page],
    queryFn: () => orderApi.getOrders({ status, page, limit: 20 }),
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId) => orderApi.cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries(['orders']);
      setMessage({ type: 'success', text: '订单已取消' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '取消失败' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const orders = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const toggleExtensionDetails = (orderId) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>订单管理</h2>
        <Link to="/admin" className="btn btn-secondary">
          ← 返回扫码管理
        </Link>
      </div>

      <div className="filters" style={{ marginBottom: 20 }}>
        <div className="filter-row">
          <div className="filter-group">
            <label>状态:</label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">全部</option>
              {Object.entries(statusNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="loading">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="loading">暂无订单</div>
      ) : (
        <>
          <div className="order-list">
            {orders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div>
                    <span className="order-no">{order.orderNo}</span>
                    <span className="short-code" style={{ marginLeft: 12 }}>
                      {order.shortCode}
                    </span>
                    {(order.extensionCount || 0) > 0 && (
                      <span className="badge" style={{
                        marginLeft: 12, padding: '2px 8px', background: '#e8f5e9',
                        color: '#2e7d32', borderRadius: 12, fontSize: 12
                      }}>
                      已续租 {order.extensionCount} 次
                    </span>
                    )}
                  </div>
                  <span className={`status-badge status-${order.status}`}>
                    {statusNames[order.status]}
                  </span>
                </div>

                <div className="order-info">
                  {order.sku && <span>{order.sku.name}</span>}
                  <span>租期: {order.rentalDays}天</span>
                  <span>¥{order.totalAmount.toFixed(2)}</span>
                  <span>押金: ¥{order.deposit.toFixed(2)}</span>
                  {order.overdueDays > 0 && (
                    <span className="late-fee">
                      逾期{order.overdueDays}天 · ¥{order.lateFee.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="order-info" style={{ marginTop: 8 }}>
                  <span>{order.customerName}</span>
                  <span>{order.customerPhone}</span>
                  <span>{dayjs(order.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                </div>

                <div className="order-info" style={{ marginTop: 8 }}>
                  <span style={{ color: '#e67e22', fontWeight: 600 }}>
                    预计归还: {dayjs(order.expectedEndDate).format('YYYY-MM-DD')}
                  </span>
                </div>

                {order.store && (
                  <div className="order-info" style={{ marginTop: 8 }}>
                    <span className="store-badge">门店</span>
                    <span>{order.store.name}</span>
                  </div>
                )}

                {order.extensions && order.extensions.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: '#f0f4ff',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                      onClick={() => toggleExtensionDetails(order.id)}
                    >
                      <span style={{ fontWeight: 600 }}>
                        📅 续租记录 ({order.extensions.length} 次)
                      </span>
                      <span style={{ fontSize: 12, color: '#666' }}>
                        {expandedOrderId === order.id ? '收起 ▲' : '展开 ▼'}
                      </span>
                    </div>
                    {expandedOrderId === order.id && (
                      <div style={{ padding: 12, background: '#fafafa', border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 4px 4px' }}>
                        {order.extensions.map((ext, idx) => (
                          <div key={idx} style={{
                            padding: 10,
                            marginBottom: idx < order.extensions.length - 1 ? 8 : 0,
                            background: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: 4,
                            fontSize: 12,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: '#27ae60' }}>续租 {idx + 1}</span>
                              <span style={{ color: '#e67e22', fontWeight: 600 }}>
                                +{ext.additionalDays}天 · ¥{ext.fee.toFixed(2)}
                              </span>
                            </div>
                            <div style={{ color: '#666' }}>
                              {dayjs(ext.previousEndDate).format('YYYY-MM-DD')} → {dayjs(ext.newEndDate).format('YYYY-MM-DD')}
                            </div>
                            <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>
                              支付: {dayjs(ext.paidAt).format('YYYY-MM-DD HH:mm')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="order-actions">
                  {order.status === 'pending' && (
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        if (window.confirm('确定取消订单？')) {
                          cancelMutation.mutate(order.id);
                        }
                      }}
                    >
                      取消订单
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                上一页
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`page-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="page-btn"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Orders;
