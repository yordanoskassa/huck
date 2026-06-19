import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@insforge/sdk/ssr/middleware'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  try {
    await updateSession({
      requestCookies: request.cookies as unknown as Parameters<typeof updateSession>[0]['requestCookies'],
      responseCookies: response.cookies as unknown as Parameters<typeof updateSession>[0]['responseCookies'],
    })
  } catch {
    // Session update failed, continue without auth
  }

  const accessToken = request.cookies.get('insforge_access_token')?.value
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup')

  if (!accessToken && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (accessToken && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons).*)'],
}
