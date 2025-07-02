import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`responsive-container py-6 sm:py-8 lg:py-12 ${className}`}>
      {children}
    </div>
  );
};

export default PageContainer;