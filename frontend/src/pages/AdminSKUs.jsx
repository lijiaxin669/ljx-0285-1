import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { skuApi } from '../api';

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

const reasonOptions = [
  { value: 'purchase', label: '采购入库' },
  { value: 'damaged', label: '损坏报废' },
  { value: 'inventory', label: '盘点修正' },
  { value: 'other', label: '其他' },
];

const emptySKU = {
  name: '',
  brand: '',
  model: '',
  description: '',
  category: 'string',
  dailyRate: 0,
  deposit: 0,
  totalStock: 0,
};

function AdminSKUs() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState(null);
  const [createModal, setCreateModal] = useState({ visible: false });
  const [editModal, setEditModal] = useState({ visible: false, sku: null });
  const [adjustModal, setAdjustModal] = useState({ visible: false, sku: null });
  const [logsSKU, setLogsSKU] = useState(null);
  const [formData, setFormData] = useState(emptySKU);
  const [adjustData, setAdjustData] = useState({ adjustAmount: 0, reason: 'purchase', remark: '' });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => skuApi.getCategories(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-skus', category, keyword, page],
    queryFn: () =>
      skuApi.getSKUs({
        category,
        keyword,
        page,
        limit: 10,
      }),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['inventory-logs', logsSKU?.id],
    queryFn: () => skuApi.getInventoryLogs({ skuId: logsSKU?.id, limit: 20 }),
    enabled: !!logsSKU?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => skuApi.createSKU(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-skus']);
      queryClient.invalidateQueries(['skus']);
      setCreateModal({ visible: false });
      setFormData(emptySKU);
      setMessage({ type: 'success', text: 'SKU 创建成功！' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '创建失败' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => skuApi.updateSKU(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-skus']);
      queryClient.invalidateQueries(['skus']);
      queryClient.invalidateQueries(['sku']);
      setEditModal({ visible: false, sku: null });
      setMessage({ type: 'success', text: 'SKU 更新成功！' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '更新失败' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => skuApi.deleteSKU(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-skus']);
      queryClient.invalidateQueries(['skus']);
      setMessage({ type: 'success', text: 'SKU 删除成功！' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '删除失败' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }) => skuApi.adjustStock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-skus']);
      queryClient.invalidateQueries(['skus']);
      queryClient.invalidateQueries(['sku']);
      queryClient.invalidateQueries(['inventory-logs']);
      setAdjustModal({ visible: false, sku: null });
      setAdjustData({ adjustAmount: 0, reason: 'purchase', remark: '' });
      setMessage({ type: 'success', text: '库存调整成功！' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.error || '调整失败' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const skus = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / 10);
  const logs = logsData?.data?.items || [];

  const handleCreate = () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: '请输入商品名称' });
      return;
    }
    if (formData.dailyRate < 0) {
      setMessage({ type: 'error', text: '日租金不能为负数' });
      return;
    }
    if (formData.deposit < 0) {
      setMessage({ type: 'error', text: '押金不能为负数' });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (sku) => {
    setFormData({
      name: sku.name,
      brand: sku.brand,
      model: sku.model,
      description: sku.description,
      category: sku.category,
      dailyRate: sku.dailyRate,
      deposit: sku.deposit,
      totalStock: sku.totalStock,
    });
    setEditModal({ visible: true, sku });
  };

  const handleUpdate = () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: '请输入商品名称' });
      return;
    }
    if (formData.dailyRate < 0) {
      setMessage({ type: 'error', text: '日租金不能为负数' });
      return;
    }
    if (formData.deposit < 0) {
      setMessage({ type: 'error', text: '押金不能为负数' });
      return;
    }
    updateMutation.mutate({ id: editModal.sku.id, data: formData });
  };

  const handleDelete = (sku) => {
    const rentedOut = sku.totalStock - sku.available;
    const msg = rentedOut > 0
      ? `确定删除此 SKU？当前有 ${rentedOut} 件已租出，无在途订单时才可删除。`
      : '确定删除此 SKU？此操作不可恢复（硬删除）。';
    if (window.confirm(msg)) {
      deleteMutation.mutate(sku.id);
    }
  };

  const handleAdjust = (sku) => {
    setAdjustData({ adjustAmount: 0, reason: 'purchase', remark: '' });
    setAdjustModal({ visible: true, sku });
  };

  const handleConfirmAdjust = () => {
    if (adjustData.adjustAmount === 0) {
      setMessage({ type: 'error', text: '调整数量不能为 0' });
      return;
    }
    adjustMutation.mutate({
      id: adjustModal.sku.id,
      data: adjustData,
    });
  };

  const renderModalOverlay = (children) => (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: 24, width: '90%',
        maxWidth: 500, maxHeight: '90vh', overflow: 'auto'
      }}>
        {children}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>SKU 管理</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/admin" className="btn btn-secondary">
            ← 返回扫码管理
          </Link>
          <Link to="/admin/orders" className="btn btn-secondary">
            订单管理
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => { setFormData(emptySKU); setCreateModal({ visible: true }); }}
          >
            + 新建 SKU
          </button>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: 20 }}>
        <div className="filter-row">
          <div className="filter-group">
            <label>分类:</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">全部</option>
              {categoriesData?.data?.categories?.map((cat) => (
                <option key={cat.key} value={cat.key}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>搜索:</label>
            <input
              type="text"
              placeholder="名称/品牌/型号"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
              style={{ width: 200 }}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => setPage(1)}>
            查询
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setCategory('');
              setKeyword('');
              setPage(1);
            }}
          >
            重置
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="loading">加载中...</div>
      ) : (
        <>
          <div className="order-list">
            {skus.map((sku) => {
              const rentedOut = sku.totalStock - sku.available;
              return (
                <div key={sku.id} className="order-card">
                  <div className="order-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>
                        {categoryEmojis[sku.category] || '🎵'}
                      </span>
                      <div>
                        <span className="sku-category">{categoryNames[sku.category]}</span>
                        <h3 style={{ margin: '4px 0', fontSize: 16 }}>{sku.name}</h3>
                        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
                          {sku.brand} {sku.model}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="order-info" style={{ marginTop: 12 }}>
                    <span>总库存: <strong>{sku.totalStock}</strong> 件</span>
                    <span>可租: <strong style={{ color: sku.available > 0 ? '#27ae60' : '#e74c3c' }}>{sku.available}</strong> 件</span>
                    <span>已租出: {rentedOut} 件</span>
                    <span>日租金: ¥{sku.dailyRate.toFixed(2)}</span>
                    <span>押金: ¥{sku.deposit.toFixed(2)}</span>
                  </div>

                  {sku.description && (
                    <div className="order-info" style={{ marginTop: 8 }}>
                      <span style={{ color: '#666', fontSize: 13 }}>{sku.description}</span>
                    </div>
                  )}

                  <div className="order-actions" style={{ marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleEdit(sku)}
                    >
                      ✏️ 编辑
                    </button>
                    <button
                      className="btn btn-warning"
                      onClick={() => handleAdjust(sku)}
                    >
                      📦 库存调整
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setLogsSKU(logsSKU?.id === sku.id ? null : sku)}
                    >
                      📊 {logsSKU?.id === sku.id ? '收起流水' : '查看流水'}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(sku)}
                      disabled={deleteMutation.isLoading}
                    >
                      🗑️ 删除
                    </button>
                  </div>

                  {logsSKU?.id === sku.id && (
                    <div style={{
                      marginTop: 16, padding: 16, background: '#f8f9fa',
                      borderRadius: 4, border: '1px solid #e0e0e0'
                    }}>
                      <h4 style={{ marginBottom: 12, fontSize: 14 }}>
                        📋 最近库存流水 (最近 20 条)
                      </h4>
                      {logsLoading ? (
                        <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>
                      ) : logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                          暂无库存流水记录
                        </div>
                      ) : (
                        <div style={{ maxHeight: 300, overflow: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ background: '#e9ecef' }}>
                                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #ddd' }}>时间</th>
                                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #ddd' }}>类型</th>
                                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #ddd' }}>调整</th>
                                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #ddd' }}>调整前</th>
                                <th style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #ddd' }}>调整后</th>
                                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #ddd' }}>备注</th>
                                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #ddd' }}>操作人</th>
                              </tr>
                            </thead>
                            <tbody>
                              {logs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: 8 }}>
                                    {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm')}
                                  </td>
                                  <td style={{ padding: 8 }}>
                                    <span style={{
                                      padding: '2px 8px', borderRadius: 12, fontSize: 12,
                                      background: log.adjustAmount > 0 ? '#e8f5e9' : '#ffebee',
                                      color: log.adjustAmount > 0 ? '#2e7d32' : '#c62828'
                                    }}>
                                      {log.reasonName}
                                    </span>
                                  </td>
                                  <td style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: log.adjustAmount > 0 ? '#27ae60' : '#e74c3c' }}>
                                    {log.adjustAmount > 0 ? '+' : ''}{log.adjustAmount}
                                  </td>
                                  <td style={{ padding: 8, textAlign: 'right' }}>{log.beforeAvailable}</td>
                                  <td style={{ padding: 8, textAlign: 'right' }}>{log.afterAvailable}</td>
                                  <td style={{ padding: 8, color: '#666' }}>{log.remark || '-'}</td>
                                  <td style={{ padding: 8, color: '#666' }}>{log.operator}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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

      {createModal.visible && renderModalOverlay(
        <>
          <h3 style={{ marginBottom: 20 }}>➕ 新建 SKU</h3>
          <div className="form-group">
            <label>分类</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {categoriesData?.data?.categories?.map((cat) => (
                <option key={cat.key} value={cat.key}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>商品名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="请输入商品名称"
            />
          </div>
          <div className="form-group">
            <label>品牌</label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="请输入品牌"
            />
          </div>
          <div className="form-group">
            <label>型号</label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder="请输入型号"
            />
          </div>
          <div className="form-group">
            <label>描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="请输入商品描述"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>总库存 *</label>
            <input
              type="number"
              min="0"
              value={formData.totalStock}
              onChange={(e) => setFormData({ ...formData, totalStock: parseInt(e.target.value) || 0 })}
            />
            <small style={{ color: '#666' }}>可租数量初始等于总库存</small>
          </div>
          <div className="form-group">
            <label>日租金 (¥) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.dailyRate}
              onChange={(e) => setFormData({ ...formData, dailyRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="form-group">
            <label>押金 (¥) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.deposit}
              onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setCreateModal({ visible: false })}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={createMutation.isLoading}
            >
              {createMutation.isLoading ? '创建中...' : '创建'}
            </button>
          </div>
        </>
      )}

      {editModal.visible && editModal.sku && renderModalOverlay(
        <>
          <h3 style={{ marginBottom: 20 }}>✏️ 编辑 SKU</h3>
          <div className="form-group">
            <label>分类</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {categoriesData?.data?.categories?.map((cat) => (
                <option key={cat.key} value={cat.key}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>商品名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>品牌</label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>型号</label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>总库存</label>
            <input
              type="number"
              min="0"
              value={formData.totalStock}
              onChange={(e) => setFormData({ ...formData, totalStock: parseInt(e.target.value) || 0 })}
            />
            <small style={{ color: '#666' }}>
              当前已租出: {editModal.sku.totalStock - editModal.sku.available} 件
              {formData.totalStock !== editModal.sku.totalStock && (
                <span style={{ color: '#e67e22', display: 'block' }}>
                  可租将自动调整为: {editModal.sku.available + (formData.totalStock - editModal.sku.totalStock)} 件
                </span>
              )}
            </small>
          </div>
          <div className="form-group">
            <label>日租金 (¥) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.dailyRate}
              onChange={(e) => setFormData({ ...formData, dailyRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="form-group">
            <label>押金 (¥) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.deposit}
              onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setEditModal({ visible: false, sku: null })}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUpdate}
              disabled={updateMutation.isLoading}
            >
              {updateMutation.isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </>
      )}

      {adjustModal.visible && adjustModal.sku && renderModalOverlay(
        <>
          <h3 style={{ marginBottom: 20 }}>📦 库存调整</h3>
          <div style={{ padding: 16, background: '#f8f9fa', borderRadius: 4, marginBottom: 20 }}>
            <p style={{ marginBottom: 8 }}><strong>商品:</strong> {adjustModal.sku.name}</p>
            <p style={{ marginBottom: 8 }}>
              <strong>当前可租:</strong>
              <span style={{ color: adjustModal.sku.available > 0 ? '#27ae60' : '#e74c3c', fontWeight: 600, marginLeft: 8 }}>
                {adjustModal.sku.available} 件
              </span>
            </p>
            <p>
              <strong>当前总库存:</strong>
              <span style={{ marginLeft: 8 }}>{adjustModal.sku.totalStock} 件</span>
            </p>
          </div>
          <div className="form-group">
            <label>调整类型</label>
            <select
              value={adjustData.reason}
              onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
            >
              {reasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>调整数量 (正数入库/负数出库) *</label>
            <input
              type="number"
              value={adjustData.adjustAmount}
              onChange={(e) => setAdjustData({ ...adjustData, adjustAmount: parseInt(e.target.value) || 0 })}
            />
            {adjustData.adjustAmount !== 0 && (
              <small style={{
                color: adjustData.adjustAmount > 0 ? '#27ae60' : '#e74c3c',
                display: 'block',
                marginTop: 4
              }}>
                调整后可租: {adjustModal.sku.available + adjustData.adjustAmount} 件
                {adjustModal.sku.available + adjustData.adjustAmount < 0 && (
                  <span style={{ color: '#e74c3c', display: 'block' }}>
                    ⚠️ 可租数量不能为负数
                  </span>
                )}
              </small>
            )}
          </div>
          <div className="form-group">
            <label>备注</label>
            <textarea
              value={adjustData.remark}
              onChange={(e) => setAdjustData({ ...adjustData, remark: e.target.value })}
              placeholder="请输入调整备注（可选）"
              rows={2}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setAdjustModal({ visible: false, sku: null })}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmAdjust}
              disabled={adjustMutation.isLoading || adjustData.adjustAmount === 0 || (adjustModal.sku.available + adjustData.adjustAmount) < 0}
            >
              {adjustMutation.isLoading ? '调整中...' : '确认调整'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminSKUs;
