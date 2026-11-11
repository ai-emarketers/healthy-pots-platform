/** Home route: sends visitors to the login page or their portal. */
import { redirect } from 'next/navigation';

// The middleware sends signed-in users to their portal; everyone else lands on /login.
export default function Home() {
  redirect('/login');
}
