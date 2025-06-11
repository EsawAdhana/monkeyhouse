import '@/app/globals.css';
import { Inter } from 'next/font/google';
import { getServerSession } from 'next-auth';
import SessionProvider from '@/components/SessionProvider';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SurveyNavigationProvider } from '@/contexts/SurveyNavigationContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'MonkeyHouse',
  description: 'Find your ideal roommate match for your upcoming internship.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  const isLandingPage = !session;

  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className={`${inter.className} flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-white`} suppressHydrationWarning={true}>
        <SessionProvider session={session}>
          <ThemeProvider>
            <SurveyNavigationProvider>
              <NotificationProvider>
                <div className="flex flex-col min-h-screen">
                  {session && <Navigation />}
                  <main className="flex-grow">
                  {/* Subtle background pattern for all pages */}
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    {isLandingPage ? (
                      /* More subtle pattern for landing page */
                      <div className="absolute inset-0 bg-repeat bg-[length:24px_24px] opacity-[0.03]" 
                           style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)' }}>
                      </div>
                    ) : (
                      /* Existing pattern for authenticated pages */
                      <div className="absolute -left-[10%] -top-[10%] w-[120%] h-[120%] rotate-12 bg-repeat bg-[length:24px_24px] opacity-5 dark:opacity-[0.02]" 
                           style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)' }}>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative z-10">{children}</div>
                </main>
                  <Footer />
                </div>
              </NotificationProvider>
            </SurveyNavigationProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
} 