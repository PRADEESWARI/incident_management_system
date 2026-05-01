import React, { useState } from 'react';
import { Sidebar } from './Sidebar';

interface Props {
  children: React.ReactNode;
}

export const Layout: React.FC<Props> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Pass mobile toggle to children via context or prop drilling */}
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              onMenuClick: () => setMobileOpen(true),
            });
          }
          return child;
        })}
      </div>
    </div>
  );
};
