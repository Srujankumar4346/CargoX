import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="bg-[var(--bg-secondary)] shadow-sm sticky top-0 z-10 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Truck className="h-8 w-8 text-[var(--accent)]" />
            <span className="text-2xl font-bold text-[var(--text-primary)]">CargoX</span>
          </div>
          <div className="flex gap-4 items-center">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium px-4 py-2">Login</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn-primary">Register</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link to="/admin" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium px-4 py-2 mr-4">Dashboard</Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
          Move Goods. Manage Everything.
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          CargoX makes goods transportation simple with smart booking, fleet management, real-time tracking, and intelligent logistics.
        </p>
        <div className="flex justify-center gap-6">
          <Link to="/customer" className="btn-primary px-8 py-3 rounded-lg text-lg font-bold shadow-lg">
            Book a Vehicle
          </Link>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="bg-[var(--bg-primary)] text-[var(--accent)] border border-[var(--accent)] px-8 py-3 rounded-lg text-lg font-bold hover:bg-[var(--bg-secondary)] transition shadow-sm">
                Transport Login
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link to="/admin" className="bg-[var(--bg-primary)] text-[var(--accent)] border border-[var(--accent)] px-8 py-3 rounded-lg text-lg font-bold hover:bg-[var(--bg-secondary)] transition shadow-sm">
              Go to Dashboard
            </Link>
          </Show>
        </div>
      </main>
    </div>
  );
}
