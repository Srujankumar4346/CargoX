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

  const handleDelete = async (id: string | number) => {
    try {
      setDeletingId(String(id));
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setToasts(prev => prev.filter(n => n.id !== id));
    } catch (e: any) {
      alert(e.message || "Cannot delete notification until trip details are completed.");
    } finally {
      setDeletingId(null);
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
      {open && createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)}></div>
          
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex">
            <div className="w-full bg-[var(--surface)] shadow-2xl flex flex-col animate-slide-in-right">
              <div className="bg-[var(--surface-elevated)] border-b border-[var(--border-theme)] px-5 py-4 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                   <h3 className="text-lg font-bold text-slate-100">Notifications</h3>
                   {unreadCount > 0 && <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full font-bold">{unreadCount} New</span>}
                 </div>
                 <div className="flex items-center gap-2">
                   {unreadCount > 0 && (
                     <button
                       onClick={markAllRead}
                       disabled={markingAll}
                       className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 transition-all disabled:opacity-50"
                       title="Mark all notifications as read"
                     >
                       <CheckCheck size={14} />
                       <span>{markingAll ? "Marking…" : "Mark all read"}</span>
                     </button>
                   )}
                   <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                   </button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                 {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                       <Bell size={48} className="opacity-20 mb-4" />
                       <p>You're all caught up!</p>
                    </div>
                 ) : (
                    <div className="divide-y divide-slate-700/50">
                      {notifications.map(n => (
                        <div key={n.id} className={`p-5 transition-colors hover:bg-slate-800/60 ${n.is_read ? 'opacity-75' : 'bg-blue-500/5'}`}>
                          <div className="flex justify-between items-start gap-3 mb-2">
                             <div className="flex items-center gap-2">
                               <h4 className={`text-sm ${n.is_read ? 'font-medium text-slate-400' : 'font-bold text-slate-100'}`}>{n.title}</h4>
                               {n.is_read && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium border border-emerald-500/20">Read</span>}
                             </div>
                             <div className="flex items-center gap-1">
                               {!n.is_read && (
                                 <button onClick={() => markRead(n.id)} className="text-blue-400 hover:text-blue-300 p-1.5 rounded hover:bg-blue-500/10 transition-colors" title="Mark as read">
                                   <CheckCircle size={16} />
                                 </button>
                               )}
                               {n.can_delete && (
                                 <button
                                   onClick={() => handleDelete(n.id)}
                                   disabled={deletingId === String(n.id)}
                                   className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                   title="Delete completed trip notification"
                                 >
                                   <Trash2 size={15} />
                                 </button>
                               )}
                             </div>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                          <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
                            <span>{new Date(n.created_at).toLocaleString()}</span>
                            {n.can_delete ? (
                              <span className="text-emerald-400/80 font-medium">Trip Completed · Deletable</span>
                            ) : (
                              <span className="text-slate-600">Active Trip Details</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Popups */}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
          {toasts.map(t => (
            <div key={t.id} className="bg-[var(--surface-elevated)] border border-[var(--border-theme)] shadow-xl rounded-lg p-4 max-w-sm animate-slide-up flex flex-col gap-1 cursor-pointer" onClick={() => { setOpen(true); setToasts(current => current.filter(x => x.id !== t.id)); }}>
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-white">{t.title}</h4>
                <button onClick={(e) => { e.stopPropagation(); setToasts(current => current.filter(x => x.id !== t.id)); }} className="text-slate-400 hover:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <p className="text-xs text-slate-300">{t.message}</p>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
