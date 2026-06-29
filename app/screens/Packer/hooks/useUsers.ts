import { useState, useEffect } from 'react'

export interface UserOption {
  id:        number
  full_name: string
  username:  string
}

export function useUsers() {
  const [users, setUsers] = useState<UserOption[]>([])

  useEffect(() => {
    fetch('/api/users/names')
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        if (!Array.isArray(data)) return
        setUsers(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map((u: any) => ({
            id:        u.id as number,
            full_name: (u.full_name || u.username) as string,
            username:  u.username as string,
          }))
        )
      })
      .catch(() => {})
  }, [])

  const userOpts = users.map(u => ({ v: u.full_name, l: u.full_name }))

  return { users, userOpts }
}
