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
    accessibility: {
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
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
  items: {
    title: 'Ítems',
    fields: {
      modelName: 'Nombre del ítem',
      identifier: 'Identificador del ítem',
    },
    actions: {
      create: 'Crear ítem',
      update: 'Actualizar ítem',
      cancelEdit: 'Cancelar edición',
      edit: 'Editar',
      delete: 'Eliminar',
      refresh: 'Actualizar',
      signOut: 'Cerrar sesión',
    },
    table: {
      title: 'Ítems registrados',
      modelName: 'Nombre del modelo',
      identifier: 'Identificador del ítem',
      actions: 'Acciones',
      empty: 'Todavía no hay ítems.',
    },
    feedback: {
      loaded: 'Ítems cargados.',
      loadFailed: 'No se pudieron cargar los ítems',
      created: 'Ítem creado.',
      createFailed: 'No se pudo crear el ítem',
      updated: 'Ítem actualizado.',
      updateFailed: 'No se pudo actualizar el ítem',
      deleted: 'Ítem eliminado.',
      deleteFailed: 'No se pudo eliminar el ítem',
      signedOut: 'Sesión cerrada.',
      signOutFailed: 'No se pudo cerrar la sesión',
      authRequired: 'Se requiere autenticación',
    },
  },
} as const

export default es
