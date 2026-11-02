import React from 'react';
import UnclaimedRestrictions from '../shared/UnclaimedRestrictions';
import { adminMenuItems } from '../../utils/adminMenuItems';

export default function AdminUnclaimedRestrictions() {
  return <UnclaimedRestrictions menuItems={adminMenuItems} userRole="admin" />;
}
