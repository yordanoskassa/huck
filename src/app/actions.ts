'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAuthActions } from '@insforge/sdk/ssr'

export async function signIn(formData: FormData) {
  const auth = createAuthActions({ cookies: await cookies() })
  const { data, error } = await auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  })
  return { user: data?.user ?? null, error }
}

export async function signUp(formData: FormData) {
  const auth = createAuthActions({ cookies: await cookies() })
  const { data, error } = await auth.signUp({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
    name: String(formData.get('name') || ''),
  })
  return {
    user: data?.user ?? null,
    requireEmailVerification: data?.requireEmailVerification ?? false,
    error,
  }
}

export async function verifyEmail(email: string, otp: string) {
  const auth = createAuthActions({ cookies: await cookies() })
  const { data, error } = await auth.verifyEmail({ email, otp })
  return { user: data?.user ?? null, error }
}

export async function signOut() {
  const auth = createAuthActions({ cookies: await cookies() })
  return auth.signOut()
}

export async function initiateGoogleOAuth() {
  const cookieStore = await cookies()
  const auth = createAuthActions({ cookies: cookieStore })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { data, error } = await auth.signInWithOAuth('google', {
    redirectTo: appUrl + '/api/auth/callback',
    skipBrowserRedirect: true,
  })

  if (error || !data?.url || !data?.codeVerifier) {
    redirect('/login?error=oauth')
  }

  cookieStore.set('insforge_code_verifier', data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  redirect(data.url)
}
