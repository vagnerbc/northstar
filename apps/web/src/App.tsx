import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/auth-context';
import { AppShell } from './components/app-shell';
import { LoadingState } from './components/async-state';
import { CartPage } from './pages/cart-page';
import { CatalogPage } from './pages/catalog-page';
import { CheckoutPage } from './pages/checkout-page';
import { OrderPage } from './pages/order-page';
import { OrdersPage } from './pages/orders-page';
import { ProductPage } from './pages/product-page';

export function App() {
  const auth = useAuth();
  if (!auth.ready) return <LoadingState label="Connecting to identity provider" />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CatalogPage />} />
        <Route path="products/:productId" element={<ProductPage />} />
        <Route
          path="cart"
          element={
            <Protected>
              <CartPage />
            </Protected>
          }
        />
        <Route
          path="checkout"
          element={
            <Protected>
              <CheckoutPage />
            </Protected>
          }
        />
        <Route
          path="orders"
          element={
            <Protected>
              <OrdersPage />
            </Protected>
          }
        />
        <Route
          path="orders/:orderId"
          element={
            <Protected>
              <OrderPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.authenticated) {
    void auth.login();
    return <LoadingState label="Redirecting to login" />;
  }
  return children;
}
