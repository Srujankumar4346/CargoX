import React from 'react';

interface CargoExpressLogoProps {
  variant?: 'full' | 'header' | 'icon' | 'badge';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTagline?: boolean;
  theme?: 'dark' | 'light';
}

export const CargoExpressLogo: React.FC<CargoExpressLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  showTagline = false,
  theme = 'light',
}) => {
  const iconSizes = {
    sm: { width: 32, height: 32 },
    md: { width: 44, height: 44 },
    lg: { width: 64, height: 64 },
    xl: { width: 84, height: 84 },
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  const taglineSizes = {
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  const currentSize = iconSizes[size] || iconSizes.md;

  // The Official CargoExpress Emblem SVG:
  // Features aerodynamic cargo truck with horizontal speed lines and a forward-pointing speed arrow.
  const LogoEmblem = (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: currentSize.width, height: currentSize.height }}
    >
      <svg
        viewBox="0 0 64 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        {/* Speed Wind Streaks (Yellow/Gold accents as in reference) */}
        <path d="M4 14H20" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
        <path d="M2 22H16" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
        <path d="M6 30H18" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />

        {/* Cargo Truck Container Body (Deep Navy Blue) */}
        <path
          d="M18 10C18 8.89543 18.8954 8 20 8H38C39.1046 8 40 8.89543 40 10V33H18V10Z"
          fill="#0F284E"
        />

        {/* Forward-pointing Speed Arrow Cutout/Detail across Container */}
        <path
          d="M26 18L33 21.5L26 25V23H22V20H26V18Z"
          fill="#10B981"
        />

        {/* Aerodynamic Cab (Navy Blue) */}
        <path
          d="M40 16H48.5C49.4678 16 50.3703 16.4475 50.9507 17.2148L55.5507 23.2148C55.8427 23.6006 56 24.0754 56 24.5636V31C56 32.1046 55.1046 33 54 33H40V16Z"
          fill="#0F284E"
        />

        {/* Cab Windshield Glass */}
        <path
          d="M42 18.5H48L52.5 24H42V18.5Z"
          fill="#38BDF8"
          fillOpacity="0.85"
        />

        {/* Front Headlight Accent */}
        <rect x="54" y="27" width="2" height="3" rx="1" fill="#FBBF24" />

        {/* Wheels */}
        <circle cx="27" cy="35" r="5" fill="#1E293B" stroke="#CBD5E1" strokeWidth="1.5" />
        <circle cx="27" cy="35" r="2" fill="#94A3B8" />

        <circle cx="48" cy="35" r="5" fill="#1E293B" stroke="#CBD5E1" strokeWidth="1.5" />
        <circle cx="48" cy="35" r="2" fill="#94A3B8" />
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center ${className}`}>{LogoEmblem}</div>;
  }

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white shadow-xs ${className}`}
      >
        {LogoEmblem}
        <span className="font-extrabold tracking-tight text-slate-900 text-sm">
          Cargo<span className="text-emerald-600">Express</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center justify-center text-center ${className}`}>
      {LogoEmblem}
      <div className="flex flex-col items-center mt-1">
        <div
          className={`font-black tracking-tight leading-none ${textSizes[size]} ${
            theme === 'dark' ? 'text-white' : 'text-[#0F284E]'
          }`}
        >
          Cargo<span className="text-emerald-600">Express</span>
        </div>
        {(showTagline || variant === 'full') && (
          <span
            className={`font-medium tracking-wide mt-1.5 ${taglineSizes[size]} ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            Fast • Reliable • Everywhere
          </span>
        )}
      </div>
    </div>
  );
};

export default CargoExpressLogo;
