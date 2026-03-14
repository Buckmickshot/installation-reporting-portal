import React, { createContext, useState, useContext } from 'react';

// Create Context
const FormDataContext = createContext();

// Default form data
const defaultFormData = {
  installationId: null,
  companyId: null,
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

  // installationLimitError: null,

  // typeOfBenefit: null,
  // otherBenefit: '',
  // amountOfBenefit: null,
  // invoice: [],
  // consumerPayment: null,

  // // Licensed Plumber Details
  // licencedPlumberName: '',
  // licencedPlumberCompanyName: '',
  // licencedPlumberCompanyAddress: '',
  // licencedPlumberPhone: '',
  // licencedPlumberLicenseNo: '',

  // // Registered Plumber Details
  // registeredPlumberName: '',
  // registeredPlumberCompanyName: '',
  // registeredPlumberCompanyAddress: '',
  // registeredPlumberPhone: '',
  // registeredPlumberRegistrationNo: '',

  // // Electrician Details
  // electricianName: '',
  // electricianCompanyName: '',
  // electricianCompanyAddress: '',
  // electricianPhone: '',
  // electricianLicenseNo: '',

  // // Refrigerant Handling Details
  // refrigerantHandlerName: '',
  // refrigerantHandlerCompanyName: '',
  // refrigerantHandlerCompanyAddress: '',
  // refrigerantHandlerPhone: '',
  // refrigerantHandlerLicenseNo: '',







  // VBAComplianceCertificateNo: '',
  // COESNo: '',

  // installationDate: '',

  // warrantyConfirmed: null,

  // // Multi Split
  // multiSplitHeatingCapacity: null,
  // multiSplitCoolingCapacity: null,
  // indoorUnitsSameManufacturer: '',

  // // Decommissioning Details
  // decommissionMethod: '',
  // removed: null,
  // notRemovedReason: '',
  // ductReplacement: '',

  // // Repair Work Details
  // remove_for_disposal: null,
  // decommission_and_leave: null,
  // complete_all_repair_work: null,
  // complete_some_repair_work: null,
  // no_repair_work: null,
  // partial_repair_details: '',

  // // Certificates and Signature
  // receivedVBACert: null,
  // receivedCESCert: null,
  // VBAInformed: null,
  // VEUFactSheet: null,
  // sizeRecommended: null,

  // section2BSignature: '',
  // section2BDate: '',
  // section2BDateFormatted: '',
  // section3ASignature:'',
  // section3ADate: '',
  // section3ADateFormatted: '',
  // section3BSignature: '',
  // section3BDate: '',
  // section3BDateFormatted: '',
  // section4BSignature: '',
  // section4BDate: '',
  // section4BDateFormatted: '',
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