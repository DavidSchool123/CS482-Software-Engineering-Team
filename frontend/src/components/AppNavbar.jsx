import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import GameNavbar from './GameNavbar';

function AppNavbar({ tableSearch, setTableSearch }) {
  const location = useLocation();

  const gamePages = ['/lobby', '/profile', '/friends', '/messages'];

  const isGamePage = gamePages.some(
    (path) =>
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
  );

  return isGamePage ? (
    <GameNavbar tableSearch={tableSearch} setTableSearch={setTableSearch} />
  ) : (
    <Navbar />
  );
}

export default AppNavbar;