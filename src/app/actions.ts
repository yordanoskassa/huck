'use server'

import { cookies } from 'next/headers'
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
  return { user: data?.user ?? null, error }
}

export async function signOut() {
  const auth = createAuthActions({ cookies: await cookies() })
  return auth.signOut()
}
