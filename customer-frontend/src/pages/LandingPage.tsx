import { Link } from "react-router-dom";
import { Truck, Map as MapIcon, Package, Zap } from "lucide-react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] overflow-hidden selection:bg-[var(--primary)] selection:text-white">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--primary)]/20 blur-[120px] rounded-full pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[60%] bg-[var(--accent)]/10 blur-[100px] rounded-full pointer-events-none"></div>
      
      <header className="glass-panel mx-4 mt-4 sticky top-4 z-50 px-6 py-4 flex justify-between items-center rounded-2xl border border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--primary)] p-2 rounded-lg text-white">
            <Truck className="h-6 w-6" />
          </div>
          <span className="text-2xl font-display font-bold tracking-tight">CargoX</span>
        </div>
        <div className="flex gap-4 items-center">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="text-[var(--muted)] hover:text-white font-medium px-4 py-2 transition-colors">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn-primary px-6">Get Started</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link to="/customer" className="text-[var(--muted)] hover:text-white font-medium px-4 py-2 mr-4 transition-colors">My Dashboard</Link>
            <UserButton />
          </Show>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="animate-slide-up text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 text-sm font-semibold mb-6">
              <Zap size={16} /> Premium Logistics Platform
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold mb-6 tracking-tight font-display leading-[1.1]">
              Move Goods. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]">
                Manage Everything.
              </span>
            </h1>
            <p className="text-xl text-[var(--muted)] mb-10 max-w-lg leading-relaxed">
              Transport management, delivery visibility, and reliable fleet operations. CargoX provides end-to-end solutions for modern businesses.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/customer" className="btn-primary px-8 py-4 rounded-xl text-lg flex items-center gap-2 group">
                Customer Booking Portal
                <Truck className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <div className="mt-12 flex gap-8 items-center text-[var(--muted)] text-sm font-medium">
               <div className="flex items-center gap-2"><MapIcon size={18} className="text-[var(--primary)]"/> Real-time Tracking</div>
               <div className="flex items-center gap-2"><Package size={18} className="text-[var(--accent)]"/> Assured Safety</div>
            </div>
          </div>

          <div className="relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
             {/* Abstract Tracking / Logistics Visual */}
             <div className="glass-panel p-2 shadow-2xl relative z-10 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <div className="bg-[var(--surface-elevated)] rounded-xl h-96 w-full relative overflow-hidden border border-[var(--border)]">
                   {/* Map Mockup */}
                   <div className="absolute inset-0 bg-slate-900 opacity-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                   
                   {/* Route line */}
                   <svg className="absolute inset-0 w-full h-full" style={{ strokeDasharray: '8 8' }}>
                      <path d="M 50,300 Q 150,200 300,250 T 500,100" fill="none" stroke="var(--primary)" strokeWidth="3" className="animate-pulse" />
                   </svg>
                   
                   {/* Ping markers */}
                   <div className="absolute top-[300px] left-[50px] w-4 h-4 bg-[var(--primary)] rounded-full shadow-[0_0_15px_var(--primary)]"></div>
                   <div className="absolute top-[100px] left-[500px] w-4 h-4 bg-[var(--success)] rounded-full shadow-[0_0_15px_var(--success)]"></div>
                   
                   {/* Moving truck (CSS animation mocked) */}
                   <div className="absolute top-[220px] left-[250px] bg-white text-black p-2 rounded shadow-lg flex items-center gap-2 font-bold text-xs">
                      <Truck size={14} className="text-[var(--primary)]" /> CX-TRK-99
                   </div>

                   {/* Floating status card */}
                   <div className="absolute top-6 left-6 glass-panel p-4 animate-slide-in-right">
                      <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">Status</p>
                      <p className="font-bold text-[var(--success)] flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse"></div> IN TRANSIT</p>
                   </div>
                </div>
             </div>
             
             {/* Decorative element */}
             <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-[var(--accent)]/20 rounded-full blur-2xl -z-10"></div>
          </div>
          
        </div>
      </main>
    </div>
  );
}

