// Verbatim wording from the ESC "VEEC Assignment Form Template: Space Heating and
// Cooling (Activity 6) – Residential Premises", Version 1.4 – 12 December 2024.
// The ESC requires declarations to be reproduced without changes.
export const A6_FORM_TITLE = 'VEEC Assignment Form – Space Heating and Cooling (Activity 6) – Residential Premises';

export const SECTION1 = ap => [
  'As the energy consumer, you own the right to create certificates for energy saving activities undertaken at your premises under the Victorian Energy Upgrades program. One Victorian energy efficiency certificate (VEEC) represents one tonne of carbon dioxide equivalent (CO2-e) to be reduced by the activity.',
  'You can assign your right to create certificates to an accredited provider under the Victorian Energy Upgrades program. In assigning your right, the accredited provider will be entitled to create and own the certificates for the activity undertaken at your premises. In return, the accredited provider should provide you with an identifiable benefit (e.g., price reduction on a product, free installation, or a cash-back arrangement).',
  `You are responsible for ensuring you are satisfied with the terms of the assignment of certificates to ${ap}, the accredited provider (as detailed below) prior to proceeding with the activity.`,
  `If you experience any issues with the outcome of this activity, you should contact ${ap} to resolve the matter. For any outstanding issues, you can contact program staff members at the Essential Services Commission, the government body responsible for administering the program, by sending an email to veu@esc.vic.gov.au.`,
];

export const SCENARIOS = [
  ['i', 'Hard-wired resistance electric room heater only (no refrigerative air conditioner) which is the main form of heating.'],
  ['ii', 'Hard-wired resistance electric heater which is the main form of heating any premises and refrigerative air conditioner'],
  ['iii', 'Central electric resistance that provides heating to at least 100m2 floor area or slab heater only (no refrigerative air conditioner) which is the main form of heating.'],
  ['iv', 'Central electric resistance that provides heating to at least 100m2 floor area or slab heater which is the main form of heating, and refrigerative air conditioner'],
  ['v', 'Ducted reverse cycle air conditioner with is the main form of heating'],
  ['vi', 'Non-ducted reverse cycle air conditioner'],
  ['vii', 'Ducted gas heater only which is the main form of heating'],
  ['viii', 'Ducted gas heater which is the main form of heating any premises and refrigerative air conditioner (whether ducted or not)'],
  ['ix', 'Non-ducted gas heater only (no refrigerative air conditioner)'],
  ['x', 'Non-ducted gas heater and refrigerative air conditioner'],
  ['xi', 'No decommissioning'],
];

export const CATEGORIES = [
  ['6A', '6A: Ducted air to air R < 10 kW'],
  ['6B(i)', '6B(i): Ducted air to air 10 kW ≤ R < 25 kW'],
  ['6B(ii)', '6B(ii): Ducted air to air 25 kW ≤ R < 39 kW'],
  ['6C', '6C: Ducted air to air 39 kW < R ≤ 65 kW'],
  ['6D', '6D: Non-ducted air to air R < 4 kW'],
  ['6E(i)', '6E(i): Non-ducted air to air 4 kW ≤ R < 7 kW'],
  ['6E(ii)', '6E(ii): Non-ducted air to air 7 kW ≤ R < 10 kW'],
  ['6F', '6F: Non-ducted air to air 10kW ≤ R ≤ 39kW'],
  ['6G', '6G Non-ducted air to air 39kW < R ≤ 65kW'],
];

export const AREAS = [
  ['0-20', '0 - 20m2'], ['21-40', '21 - 40m2'], ['41-60', '41 - 60m2'],
  ['61-80', '61 - 80m2'], ['81-100', '81 - 100m2'], ['101-120', '101 - 120m2'],
  ['121-140', '121 - 140m2'], ['141-160', '141 - 160m2'], ['161+', '161m2 +'],
];

export const BENEFITS = ['Upfront cash', 'Price reduction', 'Delayed cash', 'Free installation', 'Other'];

export const INSTALLER_DECLARATION = [
  'I am registered or licensed to undertake the installation of the above product(s)',
  'I am registered or licensed to decommission the replaced product(s), or the replaced product(s) have been decommissioned by an appropriately registered or licensed person',
  'the product(s) have been installed at a residential premises',
  'where applicable, the consumer has been informed that a VBA Compliance Certificate and/or Certificate of Electrical Safety is required for the work undertaken and will be provided a copy of the relevant certificate within five working days of installation',
  ['I have provided the consumer with the VEU Space Heating and Cooling Consumer Fact Sheet and have:',
    'provided them clear and accurate information on the suitability of the product(s) to be installed to meet their space heating and cooling needs.',
    'advised them on whether the size of the product(s) to be installed is consistent with the size recommended in the fact sheet'],
  ['where existing product(s) are decommissioned as part of this activity:',
    'the product(s) replaced as part of this installation were not installed for the purposes of being decommissioned as part of this installation',
    'the construction of the premises in which the activity was undertaken was not completed in the two-year period preceding the date the activity was undertaken.'],
  "the waste or debris generated from the activity, including the decommissioned product(s) (where it is practical and safe to remove the decommissioned product(s)), will be removed from the consumer's premises and will be disposed of in accordance with all applicable waste management requirements under the Environment Protection Act 2017 and its regulations.",
  'the installation meets all relevant laws, standards and building codes.',
  'the information supplied in this form is complete and accurate and I am aware that it is an offence to provide false or misleading information to the Essential Services Commission under the Victorian Energy Efficiency Target Act 2007.',
];

export const SCOPE_REMOVAL = [
  'disable, decommission and remove the replaced product(s) for disposal',
  'disable and decommission the replaced product(s) so that it cannot be used again, but the product will be left on site as it is not practical and safe for the product to be removed',
];
export const SCOPE_REPAIR = [
  ['all', 'undertake, or organise, the completion of all necessary building repair work as part of the installation'],
  ['some', 'undertake, or organise, the completion of some of the building repair work as part of the installation (list what work will be included and what will not be included)'],
  ['none', 'not be responsible for undertaking or organising any building repair work as part of the installation'],
];
export const SECTION3_INSTALLER = [
  'I have informed the consumer of the scope of work required to decommission the old product(s) and install new product(s) and the consumer has agreed to the above scope of work',
];
export const SECTION3_CONSUMER = [
  'the replaced product(s) will need to be decommissioned in a practical and safe manner so that it cannot be reused again',
  'I have been informed and agree to above scope of work being carried out by the installer as part of the decommissioning of old product(s) and installing new product(s)',
];

export const CONSUMER_QUESTIONS = [
  ['vbaRecv', 'I have received a VBA Compliance Certificate for the work'],
  ['coesRecv', 'I have received a Certificate of Electrical Safety for the work'],
  ['informed', 'I have been informed that a VBA Compliance Certificate and/or Certificate of Electrical Safety is required for the work undertaken and that I will be provided a copy of the relevant certificate:'],
  ['factSheet', 'I have been provided with the VEU Space Heating and Cooling Consumer Fact Sheet and have been provided clear information to assist me in choosing the appropriately sized air conditioner for my heating and cooling needs'],
  ['sizeOk', 'I have been informed that the size of the installed product is consistent with the size recommended in the VEU Space Heating and Cooling Consumer Fact Sheet'],
];

export const CONSUMER_DECLARATION = ap => [
  'I am the energy consumer of the residence at the above installation address',
  'To the best of my knowledge, the information provided by the installer in Part A, Section 2 is correct and complete',
  'the product(s) replaced as part of this installation were not installed for the purposes of being decommissioned as part of this installation',
  'the waste and/or debris generated for this activity, including the decommissioned product(s) (where it is practical and safe to remove the decommissioned product(s)), has been removed from the premises',
  `I understand that by signing this form I am assigning the right to create certificates for the installation to ${ap}`,
  `I have received an identifiable benefit from ${ap} in exchange for assigning my rights to create the certificates for the above installation.`,
  'the Essential Services Commission has the right to inspect the installation with reasonable notice',
  'I understand that information on this form will be disclosed to the Essential Services Commission for the purpose of creating certificates under the Victorian Energy Efficiency Target Act 2007 and for related verification, audit and program monitoring purposes',
  'I understand that the Essential Services Commission may use the details provided on this form to issue commission correspondence.',
  'I am aware that it is an offence to provide false or misleading information to the Essential Services Commission or any person exercising powers under or in connection with the Victorian Energy Efficiency Target Act 2007.',
];

export const FOOTNOTE_REG_PLUMBER = 'These fields are only required to be included/completed if installer undertaking the upgrade and signing this form is a registered plumber (not a licensed plumber)';
export const FOOTNOTE_COPAYMENT = 'This information is not required to be captured on the VEEC assignment form if captured in the invoice for the activity.';
