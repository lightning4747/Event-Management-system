import * as React from 'react';

export interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  text,
  fullScreen = false,
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4',
  };

  const spinnerContent = (
    <div className="flex flex-col items-center justify-center gap-3 p-4">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing ring */}
        <div
          className={`${sizeClasses[size]} rounded-full border-blue-100 animate-pulse absolute opacity-60`}
        />
        {/* Main smooth gradient spinner */}
        <div
          className={`${sizeClasses[size]} rounded-full border-t-blue-600 border-r-blue-600/40 border-b-blue-600/10 border-l-blue-600/40 animate-spin`}
        />
      </div>
      {text && (
        <p className="text-xs font-semibold text-gray-600 animate-pulse tracking-wide">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-all duration-300">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
};
