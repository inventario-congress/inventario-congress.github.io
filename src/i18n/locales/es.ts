const es = {
  meta: {
    title: 'Inventario Congress',
  },
  languageSwitcher: {
    label: 'Idioma',
    options: {
      en: 'English',
      es: 'Español',
    },
  },
  themeSwitcher: {
    toLight: 'Cambiar a tema claro',
    toDark: 'Cambiar a tema oscuro',
  },
  auth: {
    title: 'Autenticación',
    session: {
      label: 'Sesión iniciada como:',
      signedOut: 'Sin iniciar sesión',
    },
    fields: {
      name: 'Nombre',
      lastName: 'Apellido',
      email: 'Correo electrónico',
      password: 'Contraseña',
    },
    panels: {
      signInTitle: 'Iniciar sesión',
      signUpTitle: 'Crear cuenta',
      toSignUpPrefix: '¿No tienes cuenta?',
      toSignUpLink: 'Registrar un nuevo usuario',
      toSignInPrefix: '¿Ya tienes cuenta?',
      toSignInLink: 'Volver a iniciar sesión',
    },
    actions: {
      signIn: 'Iniciar sesión',
      signUp: 'Registrarse',
      signOut: 'Cerrar sesión',
    },
    feedback: {
      error: 'Error:',
      status: 'Estado:',
      loggedIn: 'Sesión iniciada correctamente.',
      signUpWithSession: 'Registro completado y sesión creada.',
      signUpCheckEmail: 'Registro iniciado. Revisa tu correo para confirmar la cuenta.',
      signedOut: 'Sesión cerrada.',
      dbLoaded: 'La consulta a la base de datos se completó correctamente.',
      loginFailed: 'No se pudo iniciar sesión',
      signUpFailed: 'No se pudo completar el registro',
      signOutFailed: 'No se pudo cerrar la sesión',
      fetchDbFailed: 'No se pudo consultar la base de datos',
    },
  },
} as const

export default es
