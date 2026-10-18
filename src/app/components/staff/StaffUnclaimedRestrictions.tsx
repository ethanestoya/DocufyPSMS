import React from 'react';
import UnclaimedRestrictions from '../shared/UnclaimedRestrictions';
import { staffMenuItems } from './StaffOrdersUnified';

export default function StaffUnclaimedRestrictions() {
  return <UnclaimedRestrictions menuItems={staffMenuItems} userRole="staff" />;
}
