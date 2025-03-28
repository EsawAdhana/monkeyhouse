import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get the token (if authenticated)
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });
  
  // Define which paths are protected (require auth) and which are auth paths
  const isAuthPath = pathname === '/signin';
  const isProtectedPath = pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname === '/welcome';
  const isRedirectPath = pathname === '/' || pathname === '';
  
  // Redirect logic
  if (isAuthPath) {
    if (token) {
      // User is already authenticated and trying to access auth pages
      // Redirect to welcome page for new session users, they'll be redirected to dashboard if they've already completed the survey
      return NextResponse.redirect(new URL('/welcome', request.url));
    }
    // Allow unauthenticated users to access auth pages
    return NextResponse.next();
  }
  
  if (isProtectedPath && !token) {
    // User is not authenticated but trying to access protected pages
    return NextResponse.redirect(new URL('/signin', request.url));
  }
  
  if (isRedirectPath && token) {
    // Authenticated user at root path - redirect to welcome page
    return NextResponse.redirect(new URL('/welcome', request.url));
  }
  
  if (isRedirectPath && !token) {
    // Unauthenticated user at root path - redirect to signin
    return NextResponse.redirect(new URL('/signin', request.url));
  }
  
  // Default: allow the request
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: ['/', '/dashboard/:path*', '/admin/:path*', '/signin', '/welcome'],
}; 