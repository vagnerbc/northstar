import { Button, Text } from '@chakra-ui/react';
import { LogIn, LogOut, ShoppingBag, ShoppingCart } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/auth-context';

export function AppShell() {
  const auth = useAuth();
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark">N</span>
          <span>Northstar</span>
        </Link>
        <nav aria-label="Primary navigation">
          <NavLink to="/" end>
            Shop
          </NavLink>
          {auth.authenticated && <NavLink to="/orders">Orders</NavLink>}
          {auth.authenticated && (
            <NavLink to="/cart" aria-label="Cart">
              <ShoppingCart size={19} /> Cart
            </NavLink>
          )}
        </nav>
        <div className="account-actions">
          {auth.authenticated ? (
            <>
              <Text hideBelow="md" fontSize="sm">
                {auth.userName}
              </Text>
              <Button size="sm" variant="ghost" onClick={() => void auth.logout()}>
                <LogOut size={17} /> Logout
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => void auth.register()}>
                <ShoppingBag size={17} /> Register
              </Button>
              <Button size="sm" onClick={() => void auth.login()}>
                <LogIn size={17} /> Login
              </Button>
            </>
          )}
        </div>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer>
        <p>Northstar Store · An event-driven systems study project</p>
      </footer>
    </>
  );
}
