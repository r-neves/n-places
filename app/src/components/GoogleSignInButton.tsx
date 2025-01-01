import { signIn } from 'next-auth/react'
import styles from "./google.module.css";
import { GoogleLogo } from '@/lib/constants/svg';

const GoogleSignInButton = () => {
  return (
    <button
      className={styles.googleButton}
      onClick={() => signIn('google')}
    >
      <GoogleLogo />
      <p className={styles.textDiv}>Sign in with Google</p>
    </button>
  )
}

export default GoogleSignInButton