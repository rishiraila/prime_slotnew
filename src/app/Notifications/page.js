'use client';
import React, { useState } from 'react';
import Image from 'next/image';

const dummyNotifications = [
  {
    id: 1,
    avatar: '/assets/img/avatars/1.png', // Admin avatar
    title: 'User Role Updated',
    description: "You have been assigned the 'Editor' role by an administrator.",
    time: '15m ago',
    read: false,
  },
  {
    id: 2,
    avatar: '/assets/img/avatars/3.png', // John Doe's avatar
    title: 'Account Approved',
    description: "John Doe's account has been approved and is now active.",
    time: '1h ago',
    read: false,
  },
  {
    id: 3,
    avatar: '/assets/img/avatars/5.png', // Mary Jane's avatar
    title: 'New User Registration',
    description: "A new user, 'Mary Jane', has registered and is awaiting approval.",
    time: '5h ago',
    read: true,
  },
  {
    id: 4,
    avatar: '/assets/img/avatars/1.png', // Admin avatar
    title: 'Permission Granted',
    description: "You have been granted access to the 'Financial Management' module.",
    time: '1d ago',
    read: true,
  },
  {
    id: 5,
    avatar: '/assets/img/avatars/4.png', // Peter Jones's avatar
    title: 'Access Revoked',
    description: "Peter Jones's access to 'Project Planning' has been revoked.",
    time: '2d ago',
    read: true,
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(dummyNotifications);

  const handleMarkAsRead = (id) => {
    setNotifications(
      notifications.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const handleDelete = (id) => {
    setNotifications(notifications.filter((notif) => notif.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="container-xxl flex-grow-1 container-p-y">
      <h4 className="fw-bold py-3 mb-4">
        <span className="text-muted fw-light">Settings /</span> Notifications
      </h4>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title m-0">Recent Notifications</h5>
          {unreadCount > 0 && (
            <span className="badge bg-primary">{unreadCount} Unread</span>
          )}
        </div>
        <div className="list-group list-group-flush">
          {notifications.map((notification) => (
            <div key={notification.id} className={`list-group-item list-group-item-action d-flex align-items-center ${!notification.read ? 'bg-light' : ''}`}>
              <div className="flex-shrink-0 me-3">
                <div className="avatar">
                  <Image src={notification.avatar} alt="User" width={40} height={40} className="rounded-circle" />
                </div>
              </div>
              <div className="flex-grow-1">
                <h6 className="mb-1">{notification.title}</h6>
                <p className="mb-1">{notification.description}</p>
                <small className="text-muted">{notification.time}</small>
              </div>
              <div className="flex-shrink-0 ms-3">
                {!notification.read && (
                  <button onClick={() => handleMarkAsRead(notification.id)} className="btn btn-sm btn-icon btn-text-secondary" title="Mark as read">
                    <i className="ri-mail-open-line"></i>
                  </button>
                )}
                <button onClick={() => handleDelete(notification.id)} className="btn btn-sm btn-icon btn-text-secondary" title="Delete">
                  <i className="ri-delete-bin-7-line"></i>
                </button>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="list-group-item text-center">
              <p className="mb-0">You have no notifications.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}