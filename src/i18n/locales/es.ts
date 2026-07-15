const es = {
  meta: {
    title: 'Inventario Congress',
  },
  languageSwitcher: {
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
    title: 'Inventario Congress',
    session: {
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
  microphones: {
    title: 'Micrófonos',
    fields: {
      modelName: 'Modelo',
      micTypeName: 'Tipo',
      identifier: 'Número',
    },
    actions: {
      create: 'Crear micrófono',
      update: 'Actualizar micrófono',
      cancelEdit: 'Cancelar edición',
      edit: 'Editar',
      delete: 'Eliminar',
      attach: 'Anexar',
      signOut: 'Cerrar sesión',
    },
    table: {
      modelName: 'Modelo',
      identifier: 'Número',
      micTypeName: 'Tipo',
      latestAttachmentBase: 'Base',
      actions: 'Acciones',
      empty: 'Todavía no hay micrófonos.',
    },
    dialogs: {
      editor: {
        titleCreate: 'Crear micrófono',
        titleEdit: 'Actualizar micrófono',
        description: 'Configura el número del micrófono y asocia modelo y tipo.',
        fields: {
          identifier: 'Número',
          modelName: 'Modelo',
          micTypeName: 'Tipo',
        },
        actions: {
          cancel: 'Cancelar',
          save: 'Guardar micrófono',
        },
        feedback: {
          loadFailed: 'No se pudo cargar el micrófono',
          loadingModels: 'Cargando modelos...',
          noModels: 'No hay modelos disponibles',
          addNewModel: 'Agregar nuevo modelo',
          loadingMicTypes: 'Cargando tipos...',
          noMicTypes: 'No hay tipos disponibles',
          submitting: 'Enviando...',
          createFailed: 'No se pudo crear el micrófono',
          updateFailed: 'No se pudo actualizar el micrófono',
          authRequired: 'Se requiere autenticación',
          addNewModelCreateFailed: 'No se pudo crear el modelo',
        },
        addNewModelDialog: {
          title: 'Agregar nuevo modelo',
          description: 'Ingresa el nombre del nuevo modelo.',
          fields: {
            modelName: 'Nombre del modelo',
          },
          actions: {
            cancel: 'Cancelar',
            save: 'Agregar modelo',
          },
          feedback: {
            submitting: 'Agregando...',
          },
        },
      },
    },
    feedback: {
      loaded: 'Micrófonos cargados.',
      loadFailed: 'No se pudieron cargar los micrófonos',
      created: 'Micrófono creado.',
      createFailed: 'No se pudo crear el micrófono',
      updated: 'Micrófono actualizado.',
      updateFailed: 'No se pudo actualizar el micrófono',
      deleted: 'Micrófono eliminado.',
      deleteFailed: 'No se pudo eliminar el micrófono',
      signedOut: 'Sesión cerrada.',
      signOutFailed: 'No se pudo cerrar la sesión',
      authRequired: 'Se requiere autenticación',
    },
  },
  menu: {
    ariaLabel: 'Menú de la aplicación',
    toggle: 'Menú',
    close: 'Cerrar menú',
    system: {
      title: 'Sistema',
      microphones: 'Micrófonos',
      bases: 'Bases',
      locations: 'Ubicaciones',

    },
    user: {
      title: 'Mi cuenta',
      profile: 'Perfil',
      signOut: 'Cerrar sesión',
    },
  },
  deleteConfirmation: {
    title: 'Confirmar eliminación',
    messagePrefix: 'Estás por eliminar lo siguiente',
    actions: {
      confirm: 'Eliminar',
      cancel: 'Cancelar',
    },
  },
  locations: {
    title: 'Ubicaciones',
    fields: {
      name: 'Nombre de la ubicación',
      address: 'Dirección',
    },
    actions: {
      create: 'Crear ubicación',
      update: 'Actualizar ubicación',
      cancelEdit: 'Cancelar edición',
      edit: 'Editar',
      delete: 'Eliminar',
    },
    dialogs: {
      editor: {
        titleCreate: 'Crear ubicación',
        titleEdit: 'Actualizar ubicación',
        description: 'Configura los detalles de la ubicación y asocia salas a esta ubicación.',
        fields: {
          name: 'Nombre de la ubicación',
          address: 'Dirección',
        },
        actions: {
          cancel: 'Cancelar',
          save: 'Guardar ubicación',
        },
        feedback: {
          loadFailed: 'No se pudo cargar la ubicación',
          loadRoomsFailed: 'No se pudieron cargar las salas de la ubicación',
          createFailed: 'No se pudo crear la ubicación',
          updateFailed: 'No se pudo actualizar la ubicación',
          createRoomFailed: 'No se pudo crear la sala',
          roomsCreateRequiresSavedLocation: 'Primero guarda la ubicación antes de agregar salas.',
          duplicateRoomForLocation: 'Ya existe una sala con ese nombre para esta ubicación.',
          submitting: 'Enviando...',
        },
        rooms: {
          title: 'Salas',
          description: 'Selecciona las salas que pertenecen a esta ubicación. También puedes crear salas nuevas para esta ubicación.',
          noneSelected: 'No hay salas seleccionadas',
          selectedCountSuffix: 'salas seleccionadas',
          addRequiresSavedLocation: 'Debes guardar la ubicación antes de agregar salas.',
          addRoom: 'Agregar sala',
          loadingRooms: 'Cargando salas...',
          noneAssociated: 'Todavía no hay salas asociadas a esta ubicación.',
          tableDeleteLabel: 'Eliminar',
          addRoomDialogOpen: '',
        },
        addRoomDialog: {
          title: 'Agregar nueva sala',
          description: 'Ingresa el nombre de la nueva sala. Se asociará a la ubicación seleccionada.',
          fields: {
            roomName: 'Nombre de la sala',
          },
          actions: {
            cancel: 'Cancelar',
            save: 'Agregar sala',
          },
          feedback: {
            submitting: 'Agregando...',
          },
        },
      },
    },
    table: {
      name: 'Nombre',
      address: 'Dirección',
      actions: 'Acciones',
      empty: 'Todavía no hay ubicaciones.',
      rooms: 'Salas',
    },
    feedback: {
      loaded: 'Ubicaciones cargadas.',
      loadFailed: 'No se pudieron cargar las ubicaciones',
      created: 'Ubicación creada.',
      createFailed: 'No se pudo crear la ubicación',
      updated: 'Ubicación actualizada.',
      updateFailed: 'No se pudo actualizar la ubicación',
      deleted: 'Ubicación eliminada.',
      deleteFailed: 'No se pudo eliminar la ubicación',
    },
  },


  attachments: {
    forms: {
      title: 'Editor de anexos',
    },
    fields: {
      base: 'Base',
      microphone: 'Micrófono',
      state: 'Estado del anexo',
      selectBase: 'Selecciona una base',
      selectMicrophone: 'Selecciona un micrófono',
    },
    states: {
      attach: 'Anexado',
      detach: 'Desanexado',
    },
    actions: {
      create: 'Crear anexo',
      update: 'Actualizar anexo',
      cancelEdit: 'Cancelar edición',
      edit: 'Editar',
      delete: 'Eliminar',
    },
    table: {
      title: 'Anexos más recientes',
      createdAt: 'Fecha',
      base: 'Base',
      microphone: 'Micrófono',
      state: 'Estado',
      user: 'Usuario',
      actions: 'Acciones',
      empty: 'Todavía no hay registros de anexos.',
    },
    feedback: {
      created: 'Anexo creado.',
      createFailed: 'No se pudo crear el anexo',
      updated: 'Anexo actualizado.',
      updateFailed: 'No se pudo actualizar el anexo',
      deleted: 'Anexo eliminado.',
      deleteFailed: 'No se pudo eliminar el anexo',
    },
  },
  profile: {
    title: 'Perfil',
    fields: {
      name: 'Nombre:',
      lastName: 'Apellido:',
      email: 'Correo electrónico:',
    },
    actions: {
      changePassword: 'Cambiar contraseña',
    },
    dialogs: {
      changePassword: {
        title: 'Cambiar tu contraseña',
        description: 'Ingresa una nueva contraseña abajo. Seguirás con la sesión iniciada.',
        fields: {
          newPassword: 'Nueva contraseña',
          confirmPassword: 'Confirmar nueva contraseña',
        },
        actions: {
          cancel: 'Cancelar',
          save: 'Guardar contraseña',
        },
        feedback: {
          passwordMismatch: 'Las contraseñas no coinciden.',
          saved: 'Contraseña actualizada correctamente.',
          saveFailed: 'No se pudo actualizar la contraseña.',
          notAuthenticated: 'Debes iniciar sesión para cambiar tu contraseña.',
          loading: 'Guardando...',
        },
      },
    },
  },
  bases: {
    title: 'Bases',
    fields: {
      identifier: 'Número',
      maxMicCount: 'Cantidad máxima de micrófonos',
      models: 'Modelos',
    },
    actions: {
      create: 'Crear base',
      update: 'Actualizar base',
      cancelEdit: 'Cancelar',
      edit: 'Editar',
      delete: 'Eliminar',
      move: 'Mover',
      cancelMove: 'Cancelar',
    },
    dialogs: {
      moveBase: {
        title: 'Mover la base a una ubicación',
        searchLabel: 'Ubicación',
        searchPlaceholder: 'Buscar ubicaciones...',
        roomLabel: 'Sala',
        roomSearchPlaceholder: 'Selecciona una sala...',
        roomsNoneAssociated: 'No hay salas asociadas a esta ubicación.',
        moveDisabledReason: 'Selecciona una ubicación y una sala para habilitar mover',
        empty: 'No hay ubicaciones disponibles.',
      },
      editor: {
        title: 'Crear base ',
        description: 'Configura la base y asocia los modelos de micrófono.',
        fields: {
          identifier: 'Número',
          maxMicCount: 'Cantidad máxima de micrófonos',
          models: 'Modelos',
        },
        actions: {
          cancel: 'Cancelar',
          save: 'Guardar base',
        },
        feedback: {
          saved: 'Base guardada correctamente.',
          saveFailed: 'No se pudo guardar la base.',
          loading: 'Guardando...',
          modelSelectorNone: 'No se seleccionaron modelos',
          modelSelectorSelected: 'modelos seleccionados',
          loadingModels: 'Cargando modelos...',
          noModels: 'No hay modelos disponibles',
          submitting: 'Enviando...',
        },
      },
    },
    table: {
      identifier: 'Número',
      micModelNames: 'Modelos',
      latestLocation: 'Ubicación',
      actions: 'Acciones',
      empty: 'Todavía no hay bases.',
    },
    feedback: {
      loaded: 'Bases cargadas.',
      loadFailed: 'No se pudieron cargar las bases',
      created: 'Base creada.',
      createFailed: 'No se pudo crear la base',
      updated: 'Base actualizada.',
      updateFailed: 'No se pudo actualizar la base',
      deleted: 'Base eliminada.',
      deleteFailed: 'No se pudo eliminar la base',
    },
  },
} as const

export default es

