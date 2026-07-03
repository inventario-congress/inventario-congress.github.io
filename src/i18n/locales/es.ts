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
    connection: {
      label: 'Conexión a Supabase:',
      checking: 'Comprobando...',
      connected: 'Conectado',
      failed: 'Sin conexión',
    },
    setupRequired: {
      title: 'Configuración requerida.',
      messageStart: 'Añade',
      messageMiddle: 'y',
      messageEnd: 'a un archivo',
      messageSuffix: 'en la raíz del proyecto.',
    },
    session: {
      label: 'Sesión iniciada como:',
      signedOut: 'Sin iniciar sesión',
    },
    fields: {
      email: 'Correo electrónico',
      password: 'Contraseña',
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
    database: {
      title: 'Visor de base de datos (con sesión iniciada)',
      tableLabel: 'Tabla:',
      editHintStart: '(editar en',
      editHintEnd: ')',
      fetchRows: 'Cargar las primeras 20 filas',
      loading: 'Cargando...',
      empty: 'Todavía no se han cargado datos.',
    },
  },
} as const

export default es
