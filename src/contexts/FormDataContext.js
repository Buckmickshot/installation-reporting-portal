import React, { createContext, useState, useContext } from 'react';

// Create Context
const FormDataContext = createContext();

// Default form data
const defaultFormData = {
  installationId: null,
  companyId: null,
  premisesId: null,
  consumerId: null,
  status: null,
  jobRef: null,
  installationDate: '',
  invalidFields: {},
  createdAt: null,
  updatedAt: null,

  // Activity Type
  activityType: null,
  premisesType: null,

  // Pre-Quote Information
  firstName: '',
  surname: '',
  clientPhone: '',
  email: '',
  installationAddress: '',

  buildingAgeCheck: null,
  buildingDates: {
    certificateDateFiles: [],
    certificateDate: '',
    inspectionDateFiles: [],
    inspectionDate: '',
    handoverDateFiles: [],
    handoverDate: '',
    statutoryDecDateFiles: [],
    statutoryDecDate: '',
  },
  dateErrors: {
    certificateDate: '',
    statutoryDecDate: '',
    inspectionDate: '',
    handoverDate: '',
  },

  ductedCount: '0',
  ductedDecomCount: '0',
  nonDuctedCount: '0',
  nonDuctedDecomCount: '0',
  statutoryDeclarations: [],

  decommissionedProducts: [
    {
      decommissionScenario: '',
      brand: '',
      model: '',
      // COESRequired: null,
      // VBARequired: null,
    },
  ],

  decommissionSteps: {},

  rooms: [
  ],

  installedProducts: [
    {
      productCategory: null,
      brand: '',
      model: '',
      serialNo: '',
      productType: '',
      unitConfiguration: '',
      unitMount: '',
      heatingCapacity: '',
      coolingCapacity: null,
      selectedArea: null,
      matchSize: null,
      sizeReason: '',
      selectedRooms: [
      ],
      areaBucket: null,
      minCoPayment: '',
      coPayment: '',
    }
  ],
};

export const FormDataProvider = ({ children }) => {
  const [formData, setFormData] = useState(defaultFormData);

  const updateFormData = (update) => {
    setFormData((prevState) =>
      typeof update === 'function' ? update(prevState) : { ...prevState, ...update }
    );
  };

  const updateInvalidFields = (section, field, errorType = null) => {
    setFormData(prev => {
      const currentInvalid = { ...prev.invalidFields };

      if (!currentInvalid[section]) currentInvalid[section] = {};

      if (errorType) {
        currentInvalid[section][field] = errorType;
      } else {
        delete currentInvalid[section][field];
        if (Object.keys(currentInvalid[section]).length === 0) {
          delete currentInvalid[section];
        }
      }

      return { ...prev, invalidFields: currentInvalid };
    });
  };

  // Reset the form data to its default state
  const resetFormData = () => {
    setFormData(defaultFormData);
  };

  return (
    <FormDataContext.Provider value={{ formData, updateFormData, resetFormData, updateInvalidFields }}>
      {children}
    </FormDataContext.Provider>
  );
};

// Custom hook to access FormData
export const useFormData = () => {
  return useContext(FormDataContext);
};