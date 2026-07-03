/**
 * Skip link component for keyboard navigation.
 * 
 * @file SkipLink.tsx
 * @location frontend/src/components/Accessible/SkipLink.tsx
 */

import React from 'react';
import { AccessibilityHelpers } from '../../utils/accessibility';

interface SkipLinkProps {
  targetId: string;
  label?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  targetId,
  label = 'Skip to main content',
}) => {
  React.useEffect(() => {
    AccessibilityHelpers.createSkipLink(targetId, label);
  }, [targetId, label]);

  return null;
};

export default SkipLink;