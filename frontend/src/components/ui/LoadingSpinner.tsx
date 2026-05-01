import React from 'react';
import clsx from 'clsx';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<Props> = ({ size = 'md', className }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-gray-300 border-t-brand-600', sizes[size], className)} />
  );
};

export const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <LoadingSpinner size="lg" className="mx-auto mb-3" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);
