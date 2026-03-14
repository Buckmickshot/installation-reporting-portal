export const sectionsConfig = {
    // ─── Customer / Worker Info ────────────────────────────────────────────
    'Client Details': {
      table: 'consumer_details',
      fields: {
        firstName:   'first_name',
        surname:     'last_name',
        clientPhone: 'phone_number',
        email:       'email_address',
      },
    },

    'Premises': {
      table: 'premises',
      fields: {
        installationAddress:   'full_address',
        premisesType:     'premises_type',
      },
    },

    'Activity 6 Registry': {
      table: 'activity_6_registry',
      fields: {
        productCategory:      'Product Category No.',
        brand:                'Brand',
        model:                'Model',
        productType:          'Product Type',
        unitConfiguration:    'Product Configuration',
        unitMount:            'Product Unit Mount',
        heatingCapacity:      'Heating Capacity (kW)',
        coolingCapacity:      'Cooling Capacity (kW)',
      },
    },

    'Licenced Plumber': {
      table: 'licenced_plumber',
      fields: {
        licencedPlumberName:            'name',
        licencedPlumberCompanyName:     'company_name',
        licencedPlumberCompanyAddress:  'company_address',
        licencedPlumberPhone:           'phone_number',
        licencedPlumberLicenseNo:       'licence_number',
      }
    },

    'Registered Plumber': {
      table: 'registered_plumber',
      fields: {
        registeredPlumberName:            'name',
        registeredPlumberCompanyName:     'company_name',
        registeredPlumberCompanyAddress:  'company_address',
        registeredPlumberPhone:           'phone_number',
        registeredPlumberRegistrationNo:  'registration_number',
      }
    },

    'Electrician': {
      table: 'electrician',
      fields: {
        electricianName:           'name',
        electricianCompanyName:    'company_name',
        electricianCompanyAddress: 'company_address',
        electricianPhone:          'phone_number',
        electricianLicenseNo:      'licence_number',
      }
    },
    
    'Refrigerant Handler': {
      table: 'refrigerant_handler',
      fields: {
        refrigerantHandlerName:           'name',
        refrigerantHandlerCompanyName:    'company_name',
        refrigerantHandlerCompanyAddress: 'company_address',
        refrigerantHandlerPhone:          'phone_number',
        refrigerantHandlerLicenseNo:      'licence_number',
      }
    },
  };