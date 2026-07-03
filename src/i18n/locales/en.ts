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
  auth: {
    title: 'Authentication',
    connection: {
      label: 'Supabase connection:',
      checking: 'Checking...',
      connected: 'Connected',
      failed: 'Not connected',
    },
    setupRequired: {
      title: 'Setup required.',
      messageStart: 'Add',
      messageMiddle: 'and',
      messageEnd: 'to a',
      messageSuffix: 'file in the project root.',
    },
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
    database: {
      title: 'Database viewer (logged-in)',
      tableLabel: 'Table:',
      editHintStart: '(edit in',
      editHintEnd: ')',
      fetchRows: 'Fetch first 20 rows',
      loading: 'Loading...',
      empty: 'No data loaded yet.',
    },
  },
} as const

export default en
