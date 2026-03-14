export const FOOTNOTES = {
    16: {
    intro: 'A prescribed certificate of electrical safety is only required if the electrical mains conductors, main earthing system or main switchboard is modified.',
    items: [],
    },
    17: {
    intro:
        'A licensed plumber is required to lodge a VBA compliance certificate within five days of completing any of the following work:',
    items: [
        'has a total value $750 or more, including labour, materials, appliances and fixtures (regardless of who purchased them)',
        'was carried out on below-ground sanitary drains',
        'involved the installation, relocation, modification or conversion of any gas-using appliance or consumer gas piping,',
        'involved the construction, installation, relocation, alteration or replacement of cooling towers,',
    ],
    tail: 'Registered plumbers may not issue compliance certificates.',
    },
    20: {
    intro: 'Existing electric appliances must be connected to an electric supply before it is decommissioned.',
    items: [],
    },
    21: {
    intro: 'Existing gas appliances must be connected to a gas supply before it is decommissioned.',
    items: [],
    },
};

export const getScenarios = (isResidential) => [
    {
      id: 'i',
      title: '(i) – Hard-wired electric heater only (main heating)',
      // simple paragraph with one footnote
      body: (
        <p>
          Installer(s) must decommission a hard-wired resistance electric room heater only
          <sup>20</sup> (no refrigerative air conditioner) which is the main form of heating any premises.
        </p>
      ),
      notes: [20],
      requirements: {
        plumber: null,
        electrician: 'Grade A Electrician (or Restricted Electrical Worker’s Licence for same-type disconnect/reconnect)',
        refrigerantHandler: null,
      }
    },
    {
      id: 'ii',
      title: '(ii) – Hard-wired electric heater + refrigerative AC (main heating)',
      body: (
        <ul>
          Installer(s) must decommission:
          <ul>
            <li>
              a hard-wired resistance electric heater<sup>16</sup> which is the main form of heating any premises, and
            </li>
            <li>
              a refrigerative air conditioner (whether ducted or not)<sup>20</sup> that is not located in
              {isResidential
                  ? ' a bedroom.'
                  : ' a room with an area of less than 20 m².'}
            </li>
          </ul>
        </ul>
      ),
      notes: [16, 20],
      requirements: {
        plumber: 'Refrigerated Air-conditioning licence (or Mechanical Services licence)',
        electrician: 'Grade A Electrician (or Restricted for simple disconnect/reconnect)',
        refrigerantHandler: 'Full RHL (ARC RAC01)',
      }
    },
    {
      id: 'iii',
      title: '(iii) – Central/slab electric heater only (≥100 m²)',
      body: (
        <p>
          Installer(s) must decommission a central electric resistance that provides heating to a space
          with a floor area of at least 100 m² or slab heater only<sup>20</sup> (no refrigerative air conditioner)
          which is the main form of heating any premises.
        </p>
      ),
      notes: [20],
      requirements: {
        plumber: null,
        electrician: 'Grade A Electrician',
        refrigerantHandler: null,
      }
    },
    {
      id: 'iv',
      title: '(iv) – Central/slab electric heater + refrigerative AC (≥100 m²)',
      body: (
        <ul>
          Installer(s) must decommission:
          <ul>
            <li>
              a central electric resistance that provides heating to a space with a floor area of at least 100 m² or slab heater<sup>16</sup> which is the main form of heating any premises; and
            </li>
            <li>
              a refrigerative air conditioner (whether ducted or not)<sup>20</sup> that is not located in
              {isResidential
                  ? ' a bedroom.'
                  : ' a room with an area of less than 20 m².'}
            </li>
          </ul>
        </ul>
      ),
      notes: [16, 20],
      requirements: {
        plumber: 'Refrigerated Air-conditioning licence (or Mechanical Services licence)',
        electrician: 'Grade A Electrician',
        refrigerantHandler: 'Full RHL (ARC RAC01)',
      }
    },
    {
      id: 'v',
      title: '(v) – Ducted reverse-cycle air conditioner (main heating)',
      body: (
        <p>
          Installer(s) must decommission a ducted reverse-cycle air conditioner<sup>20</sup>
          which is the main form of heating any premises.
        </p>
      ),
      notes: [20],
      requirements: {
        plumber: 'Refrigerated Air-conditioning licence (or Mechanical Services licence)',
        electrician: 'Grade A Electrician',
        refrigerantHandler: 'Full RHL (ARC RAC01)',
      }
    },
    {
      id: 'vi',
      title: '(vi) – Non-ducted reverse-cycle air conditioner only',
      body: (
        <p>
          Installer(s) must decommission a non-ducted reverse-cycle air conditioner<sup>20</sup>.
        </p>
      ),
      notes: [20],
      requirements: {
        plumber: 'Refrigerated Air-conditioning licence (or Mechanical Services licence)',
        electrician: 'Grade A Electrician',
        refrigerantHandler: 'Full RHL (ARC RAC01)',
      }
    },
    {
      id: 'vii',
      title: '(vii) – Ducted gas heater only (main heating)',
      body: (
        <p>
          Installer(s) must decommission a ducted gas heater only<sup>21</sup><sup>17</sup> (no refrigerative air conditioner)
          which is the main form of heating any premises.
        </p>
      ),
      notes: [21],
      requirements: {
        plumber: 'Gas-fitting licence (Type B Gasfitting or Mech Services + Gasfitting)',
        electrician: 'Grade A Electrician (for any ignition/control wiring)',
        refrigerantHandler: null,
      }
    },
    {
      id: 'viii',
      title: '(viii) – Ducted gas heater + refrigerative AC (main heating)',
      body: (
        <ul>
          Installer(s) must decommission:
          <ul>
            <li>
              a ducted gas heater<sup>17</sup> which is the main form of heating any premises; and
            </li>
            <li>
              a refrigerative air conditioner<sup>16</sup> (whether ducted or not) that is not located in
              {isResidential
                  ? ' a bedroom.'
                  : ' a room with an area of less than 20 m².'}
            </li>
          </ul>
        </ul>
      ),
      notes: [16, 17],
      requirements: {
        plumber: 'Gas-fitting licence + Refrigerated Air-conditioning licence',
        electrician: 'Grade A Electrician',
        refrigerantHandler: 'Full RHL (ARC RAC01)',
      }
    },
    {
      id: 'ix',
      title: '(ix) – Non-ducted gas heater only (main heating)',
      body: (
        <p>
          Installer(s) must decommission a non-ducted gas heater only<sup>17</sup> (no refrigerative air conditioner).
        </p>
      ),
      notes: [17],
      requirements: {
        plumber: 'Gas-fitting licence',
        electrician: 'Grade A Electrician (if electrical ignition or controls)',
        refrigerantHandler: null,
      }
    },
    {
      id: 'x',
      title: '(x) – Non-ducted gas heater + refrigerative AC',
      body: (
        <ul>
          Installer(s) must decommission:
          <ul>
            <li>
              a non-ducted gas heater<sup>17</sup>; and
            </li>
            <li>
              refrigerative air conditioner<sup>16</sup> (whether ducted or not) that is not located in
              {isResidential
                  ? ' a bedroom.'
                  : ' a room with an area of less than 20 m².'}
            </li>
          </ul>
        </ul>
      ),
      notes: [16, 17],
      requirements: {
        plumber: 'Gas-fitting licence + Refrigerated Air-conditioning licence',
        electrician: 'Grade A Electrician',
        refrigerantHandler: 'Full RHL (ARC RAC01)',
      }
    },
    {
      id: 'xi',
      title: '(xi) – No decommissioning',
      body: <p>No decommissioning.</p>,
      notes: [],
      requirements: {
        plumber: null,
        electrician: null,
        refrigerantHandler: null,
      }
    },
  ];