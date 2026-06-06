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
  const [extendModal, setExtendModal] = useState({ visible: false, order: null });
  const [extendDays, setExtendDays] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-orders', phone],
    queryFn: () => orderApi.getOrders({ phone, limit: 50 }),
    enabled: !!phone,
  });

  const { data: previewData, refetch: refetchPreview } = useQuery({
    queryKey: ['extend-preview', extendModal.order?.id, extendDays],
    queryFn: () => orderApi.extendPreview(extendModal.order.id, extendDays),
    enabled: extendModal.visible && !!extendModal.order?.id,
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

  const extendMutation = useMutation({
    mutationFn: ({ orderId, additionalDays }) => orderApi.extendOrder(orderId, additionalDays),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-orders', phone]);
      setExtendModal({ visible: false, order: null });
      setMessage({ type: 'success', text: '续租成功！' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '续租失败' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const canExtend = (order) => {
    if (order.status !== 'picked_up') return false;
    if (order.status === 'overdue') return false;
    if ((order.extensionCount || 0) >= 2) return false;
    const daysUntilEnd = dayjs(order.expectedEndDate).diff(dayjs(), 'day');
    return daysUntilEnd >= 1;
  };

  const handleExtendClick = (order) => {
    setExtendDays(1);
    setExtendModal({ visible: true, order });
  };

  const handleExtendDaysChange = (days) => {
    setExtendDays(days);
    if (extendModal.order?.id) {
      setTimeout(() => refetchPreview(), 0);
    }
  };

  const handleConfirmExtend = () => {
    if (!extendModal.order) return;
    extendMutation.mutate({
      orderId: extendModal.order.id,
      additionalDays: extendDays,
    });
  };

  const renderExtensionTimeline = (order) => {
    if (!order.extensions || order.extensions.length === 0) return null;

    return (
      <div className="extension-timeline" style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 4 }}>
        <h4 style={{ marginBottom: 12, fontSize: 14, color: '#333' }}>📅 租期变更记录</h4>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%', background: '#3498db',
              flexShrink: 0, zIndex: 1
            }} />
            <div style={{ marginLeft: 12, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>初始租期</span>
              <span style={{ color: '#666', marginLeft: 8 }}>
                {dayjs(order.startDate).format('YYYY-MM-DD')} → {dayjs(order.extensions[0]?.previousEndDate || order.expectedEndDate).format('YYYY-MM-DD')}
              </span>
              <span style={{ color: '#888', marginLeft: 8 }}>
                ({order.rentalDays - order.extensions.reduce((sum, e) => sum + e.additionalDays, 0)} 天)
              </span>
            </div>
          </div>
          {order.extensions.map((ext, idx) => (
            <div key={idx}>
              <div style={{
                position: 'absolute', left: 5, top: 20 + idx * 48,
                width: 2, height: 32, background: '#e0e0e0'
              }} />
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', background: '#27ae60',
                  flexShrink: 0, zIndex: 1
                }} />
                <div style={{ marginLeft: 12, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#27ae60' }}>续租 {idx + 1}</span>
                  <span style={{ color: '#666', marginLeft: 8 }}>
                    {dayjs(ext.previousEndDate).format('YYYY-MM-DD')} → {dayjs(ext.newEndDate).format('YYYY-MM-DD')}
                  </span>
                  <span style={{ color: '#e67e22', marginLeft: 8 }}>
                    +{ext.additionalDays} 天 · ¥{ext.fee.toFixed(2)}
                  </span>
                  <div style={{ color: '#999', fontSize: 12 }}>
                    支付时间: {dayjs(ext.paidAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
                {order.status === 'picked_up' && (
                  <span style={{ color: '#e67e22', fontWeight: 600 }}>
                    预计归还: {dayjs(order.expectedEndDate).format('YYYY-MM-DD')}
                  </span>
                )}
              </div>

              {order.store && (
                <div className="order-info" style={{ marginTop: 8 }}>
                  <span>门店: {order.store.name} - {order.store.address}</span>
                </div>
              )}

              {renderExtensionTimeline(order)}

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
                  <>
                    <div className="alert alert-info">
                      请在 {dayjs(order.expectedEndDate).format('YYYY-MM-DD')} 前归还
                    </div>
                    {canExtend(order) && (
                      <button
                        className="btn btn-warning"
                        onClick={() => handleExtendClick(order)}
                        disabled={extendMutation.isLoading}
                      >
                        📅 申请续租
                      </button>
                    )}
                    {order.status === 'picked_up' && !canExtend(order) && (order.extensionCount || 0) >= 2 && (
                      <div className="alert alert-warning" style={{ marginTop: 8 }}>
                        已达到最大续租次数（2次）
                      </div>
                    )}
                  </>
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

      {extendModal.visible && extendModal.order && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{
            background: '#fff', borderRadius: 8, padding: 24, width: '90%',
            maxWidth: 500, maxHeight: '90vh', overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: 20 }}>📅 申请续租</h3>

            <div style={{ marginBottom: 20, padding: 16, background: '#f8f9fa', borderRadius: 4 }}>
              <p style={{ marginBottom: 8 }}>
                <strong>订单:</strong> {extendModal.order.orderNo}
              </p>
              {extendModal.order.sku && (
                <p style={{ marginBottom: 8 }}>
                  <strong>乐器:</strong> {extendModal.order.sku.name}
                </p>
              )}
              <p style={{ marginBottom: 8 }}>
                <strong>当前租期:</strong> {extendModal.order.rentalDays} 天
              </p>
              <p style={{ marginBottom: 8 }}>
                <strong>当前预计归还:</strong> {dayjs(extendModal.order.expectedEndDate).format('YYYY-MM-DD')}
              </p>
              <p style={{ marginBottom: 8 }}>
                <strong>日租金:</strong> ¥{extendModal.order.dailyRate.toFixed(2)}
              </p>
              <p style={{ color: '#666' }}>
                <strong>已续租:</strong> {extendModal.order.extensionCount || 0} / 2 次
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                选择续租天数:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleExtendDaysChange(Math.max(1, extendDays - 1))}
                  disabled={extendDays <= 1}
                >
                  -
                </button>
                <input
                  type="range"
                  min="1"
                  max="14"
                  value={extendDays}
                  onChange={(e) => handleExtendDaysChange(parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => handleExtendDaysChange(Math.min(14, extendDays + 1))}
                  disabled={extendDays >= 14}
                >
                  +
                </button>
                <span style={{ fontSize: 20, fontWeight: 600, minWidth: 60, textAlign: 'center' }}>
                  {extendDays} 天
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap' }}>
                {[1, 3, 7, 14].map((days) => (
                  <button
                    key={days}
                    className={`btn ${extendDays === days ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handleExtendDaysChange(days)}
                    style={{ padding: '4px 12px', fontSize: 12 }}
                  >
                    {days}天
                  </button>
                ))}
              </div>
            </div>

            {previewData?.data && (
              <div style={{
                marginBottom: 20, padding: 16, background: '#fff3e0',
                borderRadius: 4, border: '1px solid #ffe0b2'
              }}>
                <h4 style={{ marginBottom: 12, color: '#e65100' }}>💰 续租报价预览</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                  <span>追加租金:</span>
                  <span style={{ color: '#e67e22', fontWeight: 600 }}>
                    ¥{previewData.data.additionalFee.toFixed(2)}
                  </span>
                  <span>累计租期:</span>
                  <span>{previewData.data.newRentalDays} 天 (+{previewData.data.additionalDays})</span>
                  <span>新预计归还日:</span>
                  <span style={{ fontWeight: 600 }}>
                    {dayjs(previewData.data.newEndDate).format('YYYY-MM-DD')}
                  </span>
                  <span>原租金总额:</span>
                  <span>¥{previewData.data.currentTotalAmount.toFixed(2)}</span>
                  <span style={{ fontWeight: 600, borderTop: '1px solid #ddd', paddingTop: 4 }}>
                    新租金总额:
                  </span>
                  <span style={{ fontWeight: 600, color: '#e74c3c', borderTop: '1px solid #ddd', paddingTop: 4 }}>
                    ¥{previewData.data.newTotalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setExtendModal({ visible: false, order: null })}
                disabled={extendMutation.isLoading}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmExtend}
                disabled={extendMutation.isLoading || !previewData?.data}
              >
                {extendMutation.isLoading ? '支付中...' : `确认支付 ¥${previewData?.data?.additionalFee?.toFixed(2) || '0.00'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyOrders;
