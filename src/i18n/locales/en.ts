const en = {
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
    toLight: 'Switch to light theme',
    toDark: 'Switch to dark theme',
  },
  auth: {
    title: 'Congress Inventory',
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
    accessibility: {
      showPassword: 'Show password',
      hidePassword: 'Hide password',
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
  microphones: {
    title: 'Microphones',
    fields: {
      modelName: 'Model',
      micTypeName: 'Type',
      identifier: 'Identifier',
    },
    actions: {
      create: 'Create microphone',
      update: 'Update microphone',
      cancelEdit: 'Cancel edit',
      edit: 'Edit',
      delete: 'Delete',
      attach: 'Attach',
      signOut: 'Sign out',
    },
    table: {
      modelName: 'Model',
      identifier: 'Identifier',
      micTypeName: 'Type',
      latestAttachmentBase: 'Base',
      actions: 'Actions',
      empty: 'No microphones yet.',
    },
    dialogs: {
      editor: {
        titleCreate: 'Create microphone',
        titleEdit: 'Update microphone',
        description: 'Configure microphone identifier and associate model and type.',
        fields: {
          identifier: 'Identifier',
          modelName: 'Model',
          micTypeName: 'Type',
        },
        actions: {
          cancel: 'Cancel',
          save: 'Save microphone',
        },
        feedback: {
          loadFailed: 'Failed to load microphone',
          loadingModels: 'Loading models...',
          noModels: 'No models available',
          addNewModel: 'Add new model',
          loadingMicTypes: 'Loading types...',
          noMicTypes: 'No types available',
          submitting: 'Submitting...',
          createFailed: 'Failed to create microphone',
          updateFailed: 'Failed to update microphone',
          authRequired: 'Authentication is required',
          addNewModelCreateFailed: 'Failed to create model',
        },
        addNewModelDialog: {
          title: 'Add new model',
          description: 'Enter a name for the new model.',
          fields: {
            modelName: 'Model name',
          },
          actions: {
            cancel: 'Cancel',
            save: 'Add model',
          },
          feedback: {
            submitting: 'Adding...',
          },
        },
      },
    },
    feedback: {
      loaded: 'Microphones loaded.',
      loadFailed: 'Failed to load microphones',
      created: 'Microphone created.',
      createFailed: 'Failed to create microphone',
      updated: 'Microphone updated.',
      updateFailed: 'Failed to update microphone',
      deleted: 'Microphone deleted.',
      deleteFailed: 'Failed to delete microphone',
      signedOut: 'Signed out.',
      signOutFailed: 'Failed to sign out',
      authRequired: 'Authentication is required',
    },
  },
  menu: {
    ariaLabel: 'Application menu',
    toggle: 'Menu',
    close: 'Close menu',
    system: {
      title: 'System',
      microphones: 'Microphones',
      bases: 'Bases',
      locations: 'Locations',

    },
    user: {
      title: 'My account',
      profile: 'Profile',
      signOut: 'Sign out',
    },
  },
  deleteConfirmation: {
    title: 'Confirm deletion',
    messagePrefix: 'You are about to delete the following',
    actions: {
      confirm: 'Delete',
      cancel: 'Cancel',
    },
  },
  locations: {
    title: 'Locations',
    fields: {
      name: 'Location name',
      address: 'Address',
    },
    actions: {
      create: 'Create location',
      update: 'Update location',
      cancelEdit: 'Cancel edit',
      edit: 'Edit',
      delete: 'Delete',
    },
    dialogs: {
      editor: {
        titleCreate: 'Create location',
        titleEdit: 'Update location',
        description: 'Configure location details and associate rooms to this location.',
        fields: {
          name: 'Location name',
          address: 'Address',
        },
        actions: {
          cancel: 'Cancel',
          save: 'Save location',
        },
        feedback: {
          loadFailed: 'Failed to load location',
          loadRoomsFailed: 'Failed to load rooms for location',
          createFailed: 'Failed to create location',
          updateFailed: 'Failed to update location',
          createRoomFailed: 'Failed to create room',
          roomsCreateRequiresSavedLocation: 'Save the location first before adding rooms.',
          submitting: 'Submitting...',
        },
        rooms: {
          title: 'Rooms',
          description: 'Select the rooms that belong to this location. You can also create new rooms for this location.',
          noneSelected: 'No rooms selected',
          selectedCountSuffix: 'rooms selected',
          addRequiresSavedLocation: 'You must save the location before adding rooms.',
          addRoom: 'Add room',
          loadingRooms: 'Loading rooms...',
          noneAssociated: 'No rooms associated with this location yet.',
          tableDeleteLabel: 'Delete',
        },
        addRoomDialog: {
          title: 'Add new room',
          description: 'Enter a name for the new room. It will be associated to the selected location.',
          fields: {
            roomName: 'Room name',
          },
          actions: {
            cancel: 'Cancel',
            save: 'Add room',
          },
          feedback: {
            submitting: 'Adding...',
          },
        },
      },
    },
    table: {
      name: 'Name',
      address: 'Address',
      actions: 'Actions',
      empty: 'No locations yet.',
      rooms: 'Rooms',
    },
    feedback: {
      loaded: 'Locations loaded.',
      loadFailed: 'Failed to load locations',
      created: 'Location created.',
      createFailed: 'Failed to create location',
      updated: 'Location updated.',
      updateFailed: 'Failed to update location',
      deleted: 'Location deleted.',
      deleteFailed: 'Failed to delete location',
    },
  },


  attachments: {
    forms: {
      title: 'Attachment editor',
    },
    fields: {
      base: 'Base',
      microphone: 'Microphone',
      state: 'Attachment state',
      selectBase: 'Select a base',
      selectMicrophone: 'Select a microphone',
    },
    states: {
      attach: 'Attached',
      detach: 'Detached',
    },
    actions: {
      create: 'Create attachment',
      update: 'Update attachment',
      cancelEdit: 'Cancel edit',
      edit: 'Edit',
      delete: 'Delete',
    },
    table: {
      title: 'Latest attachments',
      createdAt: 'Date',
      base: 'Base',
      microphone: 'Microphone',
      state: 'State',
      user: 'User',
      actions: 'Actions',
      empty: 'No attachment records yet.',
    },
    feedback: {
      created: 'Attachment created.',
      createFailed: 'Failed to create attachment',
      updated: 'Attachment updated.',
      updateFailed: 'Failed to update attachment',
      deleted: 'Attachment deleted.',
      deleteFailed: 'Failed to delete attachment',
    },
  },
  profile: {
    title: 'Profile',
    fields: {
      name: 'Name:',
      lastName: 'Last name:',
      email: 'Email:',
    },
    actions: {
      changePassword: 'Change password',
    },
    dialogs: {
      changePassword: {
        title: 'Change your password',
        description: 'Enter a new password below. You will remain signed in.',
        fields: {
          newPassword: 'New password',
          confirmPassword: 'Confirm new password',
        },
        actions: {
          cancel: 'Cancel',
          save: 'Save password',
        },
        feedback: {
          passwordMismatch: 'Passwords do not match.',
          saved: 'Password updated successfully.',
          saveFailed: 'Failed to update password.',
          notAuthenticated: 'You must be signed in to change your password.',
          loading: 'Saving...',
        },
      },
    },
  },
  bases: {
    title: 'Bases',
    fields: {
      identifier: 'Base identifier',
      maxMicCount: 'Max mic count',
      models: 'Models',
    },
    actions: {
      create: 'Create base',
      update: 'Update base',
      cancelEdit: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      move: 'Move',
      cancelMove: 'Cancel',
    },
    dialogs: {
      moveBase: {
        title: 'Move base to a location',
        searchLabel: 'Location',
        searchPlaceholder: 'Search locations...',
        roomLabel: 'Room',
        roomSearchPlaceholder: 'Select a room...',
        roomsNoneAssociated: 'No rooms associated with this location.',
        moveDisabledReason: 'Select a location and room to enable move',
        empty: 'No available locations.',
      },
      editor: {
        title: 'Create base',
        description: 'Configure base and associate microphone models.',
        fields: {
          identifier: 'Base identifier',
          maxMicCount: 'Max mic count',
          models: 'Models',
        },
        actions: {
          cancel: 'Cancel',
          save: 'Save base',
        },
        feedback: {
          saved: 'Base saved successfully.',
          saveFailed: 'Failed to save base.',
          loading: 'Saving...',
          modelSelectorNone: 'No models selected',
          modelSelectorSelected: 'models selected',
          loadingModels: 'Loading models...',
          noModels: 'No models available',
          submitting: 'Submitting...',
        },
      },
    },
    table: {
      identifier: 'Identifier',
      maxMicCount: 'Max mic count',
      micModelNames: 'Models',
      latestLocation: 'Location',
      actions: 'Actions',
      empty: 'No bases yet.',
    },
    feedback: {
      loaded: 'Bases loaded.',
      loadFailed: 'Failed to load bases',
      created: 'Base created.',
      createFailed: 'Failed to create base',
      updated: 'Base updated.',
      updateFailed: 'Failed to update base',
      deleted: 'Base deleted.',
      deleteFailed: 'Failed to delete base',
    },
  },
} as const

export default en


