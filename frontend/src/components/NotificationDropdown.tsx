import { useState, useEffect } from "react";
import { Bell, CheckCircle } from "lucide-react";
import { api } from "../services/api";

export default function NotificationDropdown({ userType, userId }: { userType: string, userId: number }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await api.getNotifications(userType, userId);
        setNotifications(res);
      } catch (e) {
        console.error(e);
      }
    };
    fetchNotifs();
    // In a real app we might use websockets or SSE, here we just poll occasionally or load once
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, [userType, userId]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-black/10 rounded-full transition-colors">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden z-50">
          <div className="bg-gray-50 border-b border-gray-200 p-3 flex justify-between items-center">
             <h3 className="font-bold text-gray-800">Notifications</h3>
             {unreadCount > 0 && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-bold">{unreadCount} New</span>}
          </div>
          <div className="max-h-96 overflow-y-auto">
             {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
             ) : (
                notifications.map(n => (
                  <div key={n.id} className={`p-4 border-b border-gray-100 ${n.is_read ? 'opacity-60 bg-white' : 'bg-blue-50/50'}`}>
                    <div className="flex justify-between items-start mb-1">
                       <h4 className={`text-sm ${n.is_read ? 'font-medium text-gray-700' : 'font-bold text-blue-900'}`}>{n.title}</h4>
                       {!n.is_read && (
                         <button onClick={() => markRead(n.id)} className="text-blue-500 hover:text-blue-700" title="Mark as read">
                           <CheckCircle size={16} />
                         </button>
                       )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))
             )}
          </div>
        </div>
      )}
    </div>
  );
}
