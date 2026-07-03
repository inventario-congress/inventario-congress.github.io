const en = {
  meta: {
    title: 'Inventario Congress',
  },
  languageSwitcher: {
    label: 'Language',
    options: {
      en: 'English',
      es: 'Español',
    },
  },
  themeSwitcher: {
    toLight: 'Switch to light theme',
    toDark: 'Switch to dark theme',
  },
  auth: {
    title: 'Authentication',
    session: {
      label: 'Signed in as:',
      signedOut: 'Not signed in',
    },
    fields: {
      name: 'Name',
      lastName: 'Last name',
      email: 'Email',
      password: 'Password',
    },
    panels: {
      signInTitle: 'Sign in',
      signUpTitle: 'Create account',
      toSignUpPrefix: "Don't have an account?",
      toSignUpLink: 'Register a new user',
      toSignInPrefix: 'Already have an account?',
      toSignInLink: 'Back to sign in',
    },
    actions: {
      signIn: 'Log in',
      signUp: 'Sign up',
      signOut: 'Sign out',
    },
    feedback: {
      error: 'Error:',
      status: 'Status:',
      loggedIn: 'Logged in successfully.',
      signUpWithSession: 'Sign up completed and session created.',
      signUpCheckEmail: 'Sign up started. Check your email to confirm your account.',
      signedOut: 'Signed out.',
      dbLoaded: 'Database query completed successfully.',
      loginFailed: 'Login failed',
      signUpFailed: 'Sign up failed',
      signOutFailed: 'Sign out failed',
      fetchDbFailed: 'Failed to fetch database',
    },
  },
} as const

export default en
