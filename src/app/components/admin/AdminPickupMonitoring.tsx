import React from 'react';
import PickupMonitoring from '../shared/PickupMonitoring';
import { adminMenuItems } from '../../utils/adminMenuItems';

export default function AdminPickupMonitoring() {
  return <PickupMonitoring menuItems={adminMenuItems} userRole="admin" />;
}
