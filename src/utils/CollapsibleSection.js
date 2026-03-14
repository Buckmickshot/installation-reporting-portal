import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import '../components/jobCreation/JobScreen.css';

export default function CollapsibleSection({
    id,
    title,
    required = false,
    defaultOpen = true,
    children,
    ...rest
  }) {
  const [expanded, setExpanded] = useState(defaultOpen);

    return (
      <div
        id={id}
        className="field-group"
        {...rest}
      >
       <div className="collapsible-header">
         <div className="collapsible-title-wrapper">
           <div className="collapsible-title">
             {title}
             {required && <span className="asterisk visible">*</span>}
           </div>
         </div>
         <div
           className="toggle-icon-wrapper"
           onClick={() => setExpanded(!expanded)}
           title={expanded ? 'Collapse' : 'Expand'}
         >
           {expanded ? <FaChevronUp /> : <FaChevronDown />}
         </div>
       </div>

       {expanded && <div className="section-body">{children}</div>}
     </div>
   );
 }
