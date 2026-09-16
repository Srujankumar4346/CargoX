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
    <>
      <button onClick={() => setOpen(true)} className="relative p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300 hover:text-white">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
        )}
      </button>

      {/* Drawer Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)}></div>
          
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex">
            <div className="w-full bg-[var(--bg-primary)] shadow-2xl flex flex-col animate-slide-in-right">
              <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-6 py-4 flex justify-between items-center">
                 <h3 className="text-xl font-bold text-[var(--text-primary)]">Notifications</h3>
                 <div className="flex items-center gap-4">
                   {unreadCount > 0 && <span className="text-xs bg-red-500/20 text-red-500 px-3 py-1 rounded-full font-bold">{unreadCount} New</span>}
                   <button onClick={() => setOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                   </button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                 {notifications.length === 0 ? (
                    <div className="p-8 text-center text-[var(--text-secondary)] flex flex-col items-center">
                       <Bell size={48} className="opacity-20 mb-4" />
                       <p>You're all caught up!</p>
                    </div>
                 ) : (
                    <div className="divide-y divide-[var(--border-color)]">
                      {notifications.map(n => (
                        <div key={n.id} className={`p-6 transition-colors hover:bg-[var(--bg-secondary)] ${n.is_read ? 'opacity-70' : 'bg-blue-500/5'}`}>
                          <div className="flex justify-between items-start mb-2">
                             <h4 className={`text-sm ${n.is_read ? 'font-medium text-[var(--text-secondary)]' : 'font-bold text-[var(--text-primary)]'}`}>{n.title}</h4>
                             {!n.is_read && (
                               <button onClick={() => markRead(n.id)} className="text-blue-500 hover:text-blue-400 p-1" title="Mark as read">
                                 <CheckCircle size={18} />
                               </button>
                             )}
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{n.message}</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-3 opacity-60">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
