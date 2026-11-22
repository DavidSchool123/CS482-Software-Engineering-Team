
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import GameNavbar from './GameNavbar';

function AppNavbar() {
  const location = useLocation();

  const publicPages = [
    '/',
    '/account',
    '/tutorial',
    '/about',
    '/contact',
  ];

  const isPublicPage =
    publicPages.includes(location.pathname) &&
    !(location.pathname === '/tutorial' && location.state?.gameNavbar);

  return isPublicPage ? <Navbar /> : <GameNavbar />;
}

export default AppNavbar;
