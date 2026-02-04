'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
    isRead: boolean;
    createdAt: string;
    link?: string;
}

export function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch on mount and interval
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    };

    const handleMarkAsRead = async (id: string, link?: string) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));

            // API Call
            await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });

            // Navigation if link exists
            if (link) {
                setIsOpen(false);
                router.push(link);
            }
        } catch (error) {
            console.error('Failed to mark read', error);
            fetchNotifications(); // Revert on error
        }
    };

    const handleMarkAllRead = async () => {
        // Not implemented on backend yet for bulk, but we can iterate or add endpoint
        // For now, let's just do frontend optimistic and specific calls if needed, 
        // or just implement the bulk endpoint later. 
        // Let's loop for now (not efficient but fine for small numbers)
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length === 0) return;

        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);

        // Fire and forget requests
        unreadIds.forEach(id => fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'WARNING': return <AlertTriangle size={16} className="text-amber-400" />;
            case 'SUCCESS': return <CheckCircle size={16} className="text-emerald-400" />;
            case 'ERROR': return <AlertCircle size={16} className="text-red-400" />;
            default: return <Info size={16} className="text-blue-400" />;
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-slate-500 hover:text-blue-400 transition-colors pt-1 relative"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900/50">
                        <h3 className="text-sm font-semibold text-white">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                                <Check size={12} /> Marcar todas
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[70vh] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                <Bell className="mx-auto mb-2 opacity-50" size={24} />
                                No tienes notificaciones
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleMarkAsRead(notification.id, notification.link)}
                                        className={`p-4 hover:bg-slate-800/50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-slate-800/20 border-l-2 border-blue-500' : ''
                                            }`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="mt-0.5 shrink-0">
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <p className={`text-sm ${!notification.isRead ? 'text-white font-medium' : 'text-slate-300'}`}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                <p className="text-[10px] text-slate-600">
                                                    {new Date(notification.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            {!notification.isRead && (
                                                <div className="shrink-0">
                                                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
