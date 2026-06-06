import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import Orders from './pages/Orders';
import Admin from './pages/Admin';
import MyOrders from './pages/MyOrders';
import AdminSKUs from './pages/AdminSKUs';

function App() {
  return (
    <div>
      <header className="header">
        <div className="container">
          <h1>🎵 乐行连锁 · 乐器租赁</h1>
          <nav className="nav">
            <NavLink to="/" end>
              商品列表
            </NavLink>
            <NavLink to="/orders">
              我的订单
            </NavLink>
            <NavLink to="/admin">
              扫码管理
            </NavLink>
            <NavLink to="/admin/skus">
              SKU 管理
            </NavLink>
            <NavLink to="/admin/orders">
              订单管理
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<ProductList />} />
          <Route path="/sku/:id" element={<ProductDetail />} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/skus" element={<AdminSKUs />} />
          <Route path="/admin/orders" element={<Orders />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
