/** Home route: sends visitors to the login page or their portal. */
import { redirect } from 'next/navigation';

// The middleware sends signed-in users to their portal; everyone else lands on /login.
// "/" has no content of its own
export default function Home() {
  // Send visitors to the login page (middleware redirects logged-in users to their portal first)
  redirect('/login');
}
