import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // If the request is for the homepage, API, or static files, let it through
  const pathname = request.nextUrl.pathname;
  
  if (
    pathname === '/' || 
    pathname.startsWith('/_next') || 
    pathname.includes('icon') ||
    pathname.includes('png') ||
    pathname.includes('jpg')
  ) {
    return NextResponse.next();
  }

  // Redirect everything (including /api and other pages) to the homepage notice
  return NextResponse.redirect(new URL('/', request.url));
}

export const config = {
  matcher: '/:path*',
};
