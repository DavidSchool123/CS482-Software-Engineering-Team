
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import GameNavbar from './GameNavbar';

function AppNavbar({ tableSearch, setTableSearch }) {
  const location = useLocation();

  const publicPages = [
    '/',
    '/account',
    '/tutorial',
    '/about',
    '/contact',
  ];

  const isPublicPage = publicPages.includes(location.pathname);

  return isPublicPage ? (
    <Navbar />
  ) : (
    <GameNavbar
      tableSearch={tableSearch}
      setTableSearch={setTableSearch}
    />
  );
}

export default AppNavbar;
