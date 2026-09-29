import React, { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import appIconImg from '../assets/images/bmf4_brain_medical_icon_1787906946987.jpg';

interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showShadow?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  className = '',
  showShadow = true,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-7 h-7 rounded-lg text-xs',
    sm: 'w-9 h-9 rounded-xl text-sm',
    md: 'w-11 h-11 rounded-2xl text-base',
    lg: 'w-14 h-14 rounded-2xl text-lg',
    xl: 'w-20 h-20 rounded-3xl text-2xl',
  };

  const iconSizes = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  };

  return (
    <div
      className={`relative overflow-hidden shrink-0 select-none flex items-center justify-center bg-slate-900 border border-teal-400/50 ${
        sizeClasses[size]
      } ${showShadow ? 'shadow-md shadow-teal-950/60 ring-1 ring-teal-400/30' : ''} ${className}`}
      title="Bases Morfofuncionais 4 - Medicina"
    >
      {!imageError ? (
        <img
          src={appIconImg}
          alt="BMF4 Medicina"
          className="w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-teal-500 via-teal-700 to-slate-950 text-white relative">
          <Stethoscope className={`${iconSizes[size]} text-teal-200 drop-shadow-sm`} />
          <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-slate-900" />
        </div>
      )}
    </div>
  );
};

