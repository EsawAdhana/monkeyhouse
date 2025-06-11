'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { FiHome, FiSettings, FiMessageSquare, FiClipboard, FiLogOut } from 'react-icons/fi';
import { signOut } from 'next-auth/react';
import ThemeToggle from './ThemeToggle';
import useSurveyStatus from '@/hooks/useSurveyStatus';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSubmitted, loading } = useSurveyStatus();
  
  // Don't render navigation only on the landing page
  if (pathname === '/') {
    return null;
  }

  // Check which page is active
  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path === '/messages' && (pathname === '/messages' || pathname.startsWith('/messages/'))) return true;
    if (path === '/survey' && pathname.startsWith('/survey')) return true;
    if (path === '/settings' && pathname === '/settings') return true;
    return false;
  };
  
  // Handle navigation for users who haven't completed the survey
  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    // Skip check if loading, already on survey page, or survey is completed
    if (loading || path === '/survey' || isSubmitted || pathname === path) {
      return;
    }
    
    e.preventDefault();
    alert("You must complete the survey before accessing other pages.");
    router.push('/survey');
  };
  
  const navItemClasses = "flex items-center gap-1.5 px-4 py-2 rounded-md transition-colors";
  const activeClasses = "bg-blue-100 text-blue-700 font-medium dark:bg-blue-900 dark:text-blue-100";
  const inactiveClasses = "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700";
  
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 dark:bg-gray-800 dark:border-gray-700">
      <div className="max-w-6xl mx-auto px-4 flex justify-between items-center h-16">
        {/* Logo and brand */}
        <Link 
          href="/dashboard" 
          onClick={(e) => handleNavigation(e, '/dashboard')}
          className="flex items-center gap-2"
          data-navlink="true"
        >
          <span className="font-bold text-blue-600 text-lg dark:text-blue-400">MonkeyHouse</span>
        </Link>
        
        {/* Navigation items */}
        <nav className="flex items-center">
          <Link 
            href="/dashboard" 
            onClick={(e) => handleNavigation(e, '/dashboard')}
            className={`${navItemClasses} ${isActive('/dashboard') ? activeClasses : inactiveClasses}`}
            data-navlink="true"
          >
            <FiHome size={18} />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          
          <Link 
            href="/messages" 
            onClick={(e) => handleNavigation(e, '/messages')}
            className={`${navItemClasses} ${isActive('/messages') ? activeClasses : inactiveClasses}`}
            data-navlink="true"
          >
            <FiMessageSquare size={18} />
            <span className="hidden sm:inline">Messages</span>
          </Link>
          
          <Link 
            href="/survey" 
            className={`${navItemClasses} ${isActive('/survey') ? activeClasses : inactiveClasses}`}
            data-navlink="true"
          >
            <FiClipboard size={18} />
            <span className="hidden sm:inline">Survey</span>
          </Link>
          
          <Link 
            href="/settings" 
            onClick={(e) => handleNavigation(e, '/settings')}
            className={`${navItemClasses} ${isActive('/settings') ? activeClasses : inactiveClasses}`}
            data-navlink="true"
          >
            <FiSettings size={18} />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          
          <div className="ml-2 mr-2">
            <ThemeToggle />
          </div>
          
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className={`${navItemClasses} ${inactiveClasses}`}
            aria-label="Sign Out"
          >
            <FiLogOut size={18} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </nav>
      </div>
    </header>
  );
} 