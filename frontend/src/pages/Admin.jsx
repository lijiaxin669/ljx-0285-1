import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

const categoryNames = {
  string: '弦乐',
  wind: '管乐',
  percussion: '打击',
  keyboard: '键盘',
  electronic: '电子',
};

function Admin() {
  const queryClient = useQueryClient();
  const [shortCode, setShortCode] = useState('');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [message, setMessage] = useState(null);

  const lookupMutation = useMutation({
    mutationFn: (code) => orderApi.getOrderByShortCode(code),
    onSuccess: (response) => {
      setCurrentOrder(response.data);
      setMessage(null);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '未找到订单' });
      setCurrentOrder(null);
    },
  });

  const scanMutation = useMutation({
    mutationFn: ({ shortCode, action }) => orderApi.scanUpdate(shortCode, action),
    onSuccess: (response) => {
      setCurrentOrder(response.data);
      queryClient.invalidateQueries(['orders']);
      const actionNames = { pickup: '取货', return: '归还', inspect: '质检' };
      setMessage({ type: 'success', text: `${actionNames[scanMutation.variables.action]}操作成功！` });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '操作失败' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const handleLookup = (e) => {
    e.preventDefault();
    if (!shortCode.trim()) {
      setMessage({ type: 'error', text: '请输入订单短码' });
      return;
    }
    lookupMutation.mutate(shortCode.trim().toUpperCase());
  };

  const handleAction = (action) => {
    if (!shortCode.trim()) return;
    scanMutation.mutate({ shortCode: shortCode.trim().toUpperCase(), action });
  };

  const canPickup = currentOrder?.status === 'paid';
  const canReturn = currentOrder?.status === 'picked_up' || currentOrder?.status === 'overdue';
  const canInspect = currentOrder?.status === 'returned';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>管理后台 - 扫码管理</h2>
        <Link to="/admin/orders" className="btn btn-secondary">
          查看全部订单
        </Link>
      </div>

      <div className="scan-section">
        <h3 style={{ marginBottom: 20 }}>📱 扫码订单管理</h3>
        <p style={{ color: '#666', marginBottom: 20 }}>
          输入订单短码（模拟扫码），然后进行取货、归还或质检操作
        </p>

        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleLookup}>
          <div className="scan-input">
            <input
              type="text"
              placeholder="请输入或扫描订单短码 (如: A1B2C3)"
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: 2 }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={lookupMutation.isLoading}
            >
              {lookupMutation.isLoading ? '查询中...' : '查询'}
            </button>
          </div>
        </form>

        <div className="scan-actions">
          <button
            className="btn btn-success"
            onClick={() => handleAction('pickup')}
            disabled={!canPickup || scanMutation.isLoading}
          >
            ✅ 确认取货
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleAction('return')}
            disabled={!canReturn || scanMutation.isLoading}
          >
            ↩️ 确认归还
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleAction('inspect')}
            disabled={!canInspect || scanMutation.isLoading}
          >
            🔍 质检通过
          </button>
        </div>

        {currentOrder && (
          <div className="order-detail-section">
            <div className="order-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span className="order-no">{currentOrder.orderNo}</span>
                <span className={`status-badge status-${currentOrder.status}`}>
                  {statusNames[currentOrder.status]}
                </span>
              </div>
              <div className="short-code">短码: {currentOrder.shortCode}</div>
            </div>

            {currentOrder.sku && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  <span className="store-badge">
                    {categoryNames[currentOrder.sku.category]}
                  </span>
                  {currentOrder.sku.name}
                </p>
                <p style={{ color: '#666', fontSize: 14 }}>
                  {currentOrder.sku.brand} {currentOrder.sku.model}
                </p>
              </div>
            )}

            <div className="order-info" style={{ marginTop: 12 }}>
              <span>客户: {currentOrder.customerName}</span>
              <span>电话: {currentOrder.customerPhone}</span>
            </div>

            <div className="order-info" style={{ marginTop: 8 }}>
              <span>租期: {currentOrder.rentalDays} 天</span>
              <span>租金: ¥{currentOrder.totalAmount.toFixed(2)}</span>
              <span>押金: ¥{currentOrder.deposit.toFixed(2)}</span>
            </div>

            {currentOrder.overdueDays > 0 && (
              <div className="alert alert-error" style={{ marginTop: 12 }}>
                ⚠️ 逾期 {currentOrder.overdueDays} 天，需支付滞纳金 ¥{currentOrder.lateFee.toFixed(2)}
              </div>
            )}

            <div className="order-info" style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
              <span>下单: {dayjs(currentOrder.createdAt).format('YYYY-MM-DD HH:mm')}</span>
              {currentOrder.pickedUpAt && (
                <span>取货: {dayjs(currentOrder.pickedUpAt).format('YYYY-MM-DD HH:mm')}</span>
              )}
              {currentOrder.returnedAt && (
                <span>归还: {dayjs(currentOrder.returnedAt).format('YYYY-MM-DD HH:mm')}</span>
              )}
              {currentOrder.inspectedAt && (
                <span>质检: {dayjs(currentOrder.inspectedAt).format('YYYY-MM-DD HH:mm')}</span>
              )}
            </div>

            {currentOrder.store && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                <span className="store-badge">取还门店</span>
                <span style={{ fontSize: 14 }}>
                  {currentOrder.store.name} - {currentOrder.store.address}
                </span>
              </div>
            )}

            <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 4 }}>
              <h4 style={{ marginBottom: 8, fontSize: 14 }}>可执行操作:</h4>
              <ul style={{ fontSize: 13, color: '#666', paddingLeft: 20 }}>
                <li style={{ color: canPickup ? '#27ae60' : '#ccc' }}>
                  {canPickup ? '✅' : '❌'} 取货 - 订单需为"已支付"状态
                </li>
                <li style={{ color: canReturn ? '#27ae60' : '#ccc' }}>
                  {canReturn ? '✅' : '❌'} 归还 - 订单需为"已取货"或"已逾期"状态
                </li>
                <li style={{ color: canInspect ? '#27ae60' : '#ccc' }}>
                  {canInspect ? '✅' : '❌'} 质检 - 订单需为"已归还"状态（24小时内）
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
