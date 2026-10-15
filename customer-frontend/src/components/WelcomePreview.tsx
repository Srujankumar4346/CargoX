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
    <WelcomeScreen
      onGetStarted={() => navigate("/customer")}
      onLogin={() => navigate("/customer")}
    />
  );
}
