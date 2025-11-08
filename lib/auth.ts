import { cookies } from "next/headers"

export interface Session {
  user: {
    id: number
    username: string
    role: string
  }
}

export async function createSession(username: string, password: string): Promise<Session | null> {
  // Simple admin auth - in production, use proper password hashing
  if (username === "admin" && password === "admin123") {
    const session: Session = {
      user: {
        id: 1,
        username: "admin",
        role: "admin",
      },
    }

    const cookieStore = await cookies()
    cookieStore.set("session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    return session
  }

  return null
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("session")

  if (!sessionCookie) {
    return null
  }

  try {
    return JSON.parse(sessionCookie.value) as Session
  } catch {
    return null
  }
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}
