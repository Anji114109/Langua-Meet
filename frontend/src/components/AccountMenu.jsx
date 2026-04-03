import React, { useEffect, useMemo, useRef, useState } from "react";
import "./AccountMenu.css";

const getInitial = (email = "") => {
  const local = (email.split("@")[0] || "u").trim();
  return local.charAt(0).toUpperCase() || "U";
};

const AccountMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const profileName = useMemo(() => {
    if (user?.fullName) return user.fullName;
    if (user?.username) return user.username;
    return "Account";
  }, [user]);

  useEffect(() => {
    const onWindowClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("click", onWindowClick);
    return () => window.removeEventListener("click", onWindowClick);
  }, []);

  const initial = getInitial(user?.email || "");

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        className="account-avatar-btn"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open account menu"
        aria-expanded={open}
      >
        <span>{initial}</span>
      </button>

      {open && (
        <div className="account-dropdown" role="menu">
          <div className="account-dropdown-head">
            <div className="account-avatar-large">{initial}</div>
            <div className="account-meta">
              <strong>{profileName}</strong>
              <span>{user?.email || ""}</span>
            </div>
          </div>

          <button className="account-logout-btn" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
