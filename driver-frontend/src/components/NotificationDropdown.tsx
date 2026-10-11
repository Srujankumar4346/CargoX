import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCircle, CheckCheck, Trash2 } from "lucide-react";
import { api } from "../services/api";

export default function NotificationDropdown({ userType, userId }: { userType: string, userId: number }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [toasts, setToasts] = useState<any[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await api.getNotifications(userType, userId);
        
        setNotifications(prev => {
          if (prev.length > 0) {
            const newNotifs = res.filter((n: any) => !prev.find((p: any) => p.id === n.id) && !n.is_read);
            if (newNotifs.length > 0) {
              setTimeout(() => {
                setToasts(t => [...t, ...newNotifs]);
                newNotifs.forEach((n: any) => {
                  setTimeout(() => {
                    setToasts(current => current.filter(x => x.id !== n.id));
                  }, 5000);
                });
              }, 0);
            }
          }
          return res;
        });
      } catch (e) {
        console.error(e);
      }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, [userType, userId]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = async (id: string | number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotif = async (id: string | number) => {
    try {
      setDeletingId(String(id));
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e: any) {
      alert(e.message || "Failed to delete notification");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h3 className="font-semibold text-white text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllRead} 
                disabled={markingAll}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                <CheckCheck size={14} />
                {markingAll ? "Marking..." : "Mark all read"}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No notifications</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`p-3 text-xs transition ${n.is_read ? 'opacity-60 bg-slate-900/40' : 'bg-slate-800/30 font-medium'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-slate-200 font-semibold">{n.title}</span>
                    <div className="flex items-center gap-1.5 ml-2">
                      {!n.is_read && (
                        <button 
                          onClick={() => markRead(n.id)}
                          className="text-slate-400 hover:text-emerald-400" 
                          title="Mark as read"
                        >
                          <CheckCircle size={13} />
                        </button>
                      )}
                      <button 
                        onClick={() => deleteNotif(n.id)}
                        disabled={deletingId === String(n.id)}
                        className="text-slate-400 hover:text-red-400 disabled:opacity-40" 
                        title="Delete notification"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-400 mt-0.5 leading-snug">{n.message}</p>
                  <span className="text-[10px] text-slate-500 mt-2 block">
                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Real-time Toast Popups */}
      {typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map(t => (
            <div 
              key={t.id} 
              className="pointer-events-auto bg-slate-800 border border-slate-700 text-white p-3 rounded-xl shadow-xl flex items-start gap-3 animate-slide-up"
            >
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 mt-0.5">
                <Bell size={16} />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold">{t.title}</h4>
                <p className="text-[11px] text-slate-300 mt-0.5">{t.message}</p>
              </div>
              <button 
                onClick={() => setToasts(current => current.filter(x => x.id !== t.id))}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
