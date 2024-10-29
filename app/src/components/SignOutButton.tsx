import { signOut } from 'next-auth/react'
import styles from "./signout.module.css";
import { SignOutIcon } from '@/lib/util/svg';

const SignOutButton = () => {
  return (
    <button
      className={styles.signOutButton}
      onClick={() => signOut()}
    >
      <SignOutIcon />
      <p className={styles.textDiv}>Sign Out</p>
    </button>
  )
}

export default SignOutButton