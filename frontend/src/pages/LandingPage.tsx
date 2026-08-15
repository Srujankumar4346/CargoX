import { Link } from "react-router-dom";
import { Truck } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Truck className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">CargoX</span>
          </div>
          <div className="flex gap-4">
            <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium px-4 py-2">Login</Link>
            <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition">Register</Link>
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
          <Link to="/customer" className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-blue-700 transition shadow-lg">
            Book a Vehicle
          </Link>
          <Link to="/login" className="bg-white text-blue-600 border border-blue-600 px-8 py-3 rounded-lg text-lg font-bold hover:bg-gray-50 transition shadow-sm">
            Transport Login
          </Link>
        </div>
      </main>
    </div>
  );
}
