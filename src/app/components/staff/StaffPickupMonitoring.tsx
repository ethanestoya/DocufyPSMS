import React from 'react';
import PickupMonitoring from '../shared/PickupMonitoring';
import { staffMenuItems } from './StaffOrdersUnified';

export default function StaffPickupMonitoring() {
  return <PickupMonitoring menuItems={staffMenuItems} userRole="staff" />;
}
