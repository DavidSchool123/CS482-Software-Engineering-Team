import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <a href="/" className="navbar-logo">
        ♛ POKER FACE
      </a>

      <div className="navbar-links">
        <a href="/">Home</a>
        <a href="/tutorial">How to Play</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </div>

      <div className="navbar-auth">
        <a href="/login" className="login-btn">Login</a>
        <a href="/register" className="register-btn">Register</a>
      </div>
    </nav>
  );
}

export default Navbar;
