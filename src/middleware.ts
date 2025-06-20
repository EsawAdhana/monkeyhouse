import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  
  // If user is not logged in, allow the request (they'll be redirected by client-side auth)
  if (!token) {
    return NextResponse.next();
  }
  
  // Paths that don't require survey completion
  const publicPaths = ['/survey', '/api/survey', '/testing', '/api/testing', '/api/realtime'];
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  try {
    // Check if user has completed the survey
    const response = await fetch(`${request.nextUrl.origin}/api/survey`, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });
    
    const result = await response.json();
    
    // If no survey data or survey not submitted, redirect to survey
    if (!result.data?.isSubmitted && request.nextUrl.pathname !== '/') {
      return NextResponse.redirect(new URL('/survey', request.url));
    }
    
    return NextResponse.next();
  } catch (error) {
    console.error('Error in middleware:', error);
    return NextResponse.next();
  }
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes that don't need survey check
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)',
  ],
}; 