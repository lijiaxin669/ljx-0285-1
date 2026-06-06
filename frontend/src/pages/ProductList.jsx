import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

function ProductList() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(1);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => skuApi.getCategories(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['skus', category, minPrice, maxPrice, page],
    queryFn: () =>
      skuApi.getSKUs({
        category,
        minPrice,
        maxPrice,
        page,
        limit: 12,
      }),
  });

  if (isLoading) return <div className="loading">加载中...</div>;
  if (error) return <div className="loading">加载失败: {error.message || error.error}</div>;

  const skus = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / 12);

  return (
    <div>
      <div className="filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>分类:</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">全部</option>
              {categoriesData?.data?.categories?.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>日租金:</label>
            <input
              type="number"
              placeholder="最低"
              value={minPrice}
              onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
              style={{ width: 80 }}
            />
            <span>-</span>
            <input
              type="number"
              placeholder="最高"
              value={maxPrice}
              onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
              style={{ width: 80 }}
            />
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setCategory('');
              setMinPrice('');
              setMaxPrice('');
              setPage(1);
            }}
          >
            重置
          </button>
        </div>
      </div>

      <div className="sku-grid">
        {skus.map((sku) => (
          <div
            key={sku.id}
            className="sku-card"
            onClick={() => navigate(`/sku/${sku.id}`)}
          >
            <div className="sku-image">
              {categoryEmojis[sku.category] || '🎵'}
            </div>
            <div className="sku-content">
              <span className="sku-category">
                {categoryNames[sku.category]}
              </span>
              <h3 className="sku-name">{sku.name}</h3>
              <p className="sku-brand">{sku.brand} {sku.model}</p>
              <p className="sku-desc">{sku.description}</p>
              <div className="sku-price">
                <div className="daily-rate">
                  ¥{sku.dailyRate.toFixed(2)}
                  <span> / 天</span>
                </div>
                <div className={`stock ${sku.available <= 0 ? 'out' : ''}`}>
                  {sku.available > 0 ? `可租 ${sku.available} 件` : '暂无库存'}
                </div>
              </div>
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
    </div>
  );
}

export default ProductList;
