/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { StaffPortal } from './components/StaffPortal';

type AppView = 'customer' | 'staff';

function resolveInitialView(): AppView {
  if (typeof window === 'undefined') return 'customer';
  return window.location.pathname.startsWith('/staff') ? 'staff' : 'customer';
}

export default function App() {
  const [view, setView] = useState<AppView>(resolveInitialView);

  useEffect(() => {
    const handlePopState = () => {
      setView(resolveInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (target: AppView) => {
    const nextPath = target === 'staff' ? '/staff' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    setView(target);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (view === 'staff') {
    return <StaffPortal onNavigateCustomer={() => navigateTo('customer')} />;
  }

  return <LandingPage onNavigateStaff={() => navigateTo('staff')} />;
}
