'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiGithub, FiLinkedin } from 'react-icons/fi';
import { FaInstagram } from 'react-icons/fa';

export default function Footer() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();
  const isLandingPage = pathname === '/';
  const isChatPage = pathname?.startsWith('/messages/') || pathname === '/messages';
  
  // Don't show footer on any messages/chat pages
  if (isChatPage) {
    return null;
  }
  
  // Simplified footer for landing page
  if (isLandingPage) {
    return (
      <footer className="w-full py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
            <p>© {currentYear} MonkeyHouse. All rights reserved.</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-white border-t border-gray-200 py-8 mt-auto dark:bg-gray-800 dark:border-gray-700">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About section */}
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">About MonkeyHouse</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Find your ideal roommate match for your upcoming internship. 
            </p>
          </div>
          
          {/* Legal section */}
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Legal</h3>
            <ul className="text-gray-600 dark:text-gray-400 mb-6 flex flex-col items-center gap-2">
              <li>
                <Link href="/terms-of-service" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Connect With Us section */}
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Connect With Us</h3>
            <div className="flex justify-center space-x-4">
              <a 
                href="https://github.com/EsawAdhana" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
              >
                <FiGithub size={20} />
              </a>
              <a 
                href="https://www.linkedin.com/in/esawadhana/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
              >
                <FiLinkedin size={20} />
              </a>
              <a 
                href="https://www.instagram.com/esaw.adhana/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
              >
                <FaInstagram size={20} />
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-200 mt-8 pt-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:border-gray-700">
          <p>© {currentYear} MonkeyHouse. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
} 