import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import WelcomeScreen from "./customer/WelcomeScreen";

export default function WelcomePreview() {
  const navigate = useNavigate();

  // Clean onboarding completion so this preview route always replays on reload
  useEffect(() => {
    try {
      localStorage.removeItem("cargox_onboarding_completed");
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-[#070d1e] md:bg-slate-900 flex justify-center items-center overflow-x-hidden">
      <div className="relative w-full max-w-[430px] h-[100dvh] md:h-[844px] md:max-h-[92vh] bg-white flex flex-col md:my-6 md:rounded-3xl md:overflow-hidden md:shadow-2xl md:border md:border-slate-800">
        <WelcomeScreen
          onGetStarted={() => navigate("/customer")}
          onLogin={() => navigate("/customer")}
        />
      </div>
    </div>
  );
}
