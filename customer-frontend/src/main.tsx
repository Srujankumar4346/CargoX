import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClerkProvider } from '@clerk/react'

// Import your Publishable Key (fallback to default dev key if environment variable is not explicitly populated)
const DEFAULT_KEY = "pk_test_YXdhaXRlZC1yYXB0b3ItNzgyNC5jbGVyay5hY2NvdW50cy5kZXYk";
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || DEFAULT_KEY;

if (!PUBLISHABLE_KEY) {
  console.warn("Missing VITE_CLERK_PUBLISHABLE_KEY. Please provide it in Render environment variables.");
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>,
)
