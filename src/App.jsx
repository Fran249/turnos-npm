import { usePath } from './router.js'
import UserSurface from './UserSurface.jsx'
import AdminSurface from './AdminSurface.jsx'

/**
 * Two surfaces, one per role. `/user` is where someone books; `/admin` is
 * where someone manages. `/` and unknown paths fall through to the user
 * surface, so the app opens ready to use.
 */
export default function App() {
  const path = usePath()
  return path === '/admin' ? <AdminSurface /> : <UserSurface />
}
