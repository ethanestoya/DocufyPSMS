// DocuFy Contact Information and Constants

export const DOCUFY_ADDRESS = "Room 4, Palawan State University - Main Campus, TBI Building, Puerto Princesa City, 5300 Palawan";
export const DOCUFY_EMAIL = "support@docufy.com";
export const DOCUFY_PHONE = "+63 123 456 7890";

export const SHOP_HOURS = {
  weekday: "8:00 AM - 6:00 PM",
  saturday: "9:00 AM - 4:00 PM",
  sunday: "Closed",
};

// Add-ons available for purchase
export interface Addon {
  id: string;
  name: string;
  price: number;
  category: 'binding' | 'accessories' | 'supplies';
  description: string;
  unit: string;
}

export const AVAILABLE_ADDONS: Addon[] = [
  {
    id: 'addon-staples',
    name: 'Staples',
    price: 15,
    category: 'accessories',
    description: 'Standard staples for binding documents',
    unit: 'box',
  },
  {
    id: 'addon-plastic-folder-long',
    name: 'Plastic Folder (Long)',
    price: 8,
    category: 'supplies',
    description: 'Plastic folder for long documents',
    unit: 'piece',
  },
  {
    id: 'addon-plastic-folder-short',
    name: 'Plastic Folder (Short)',
    price: 7,
    category: 'supplies',
    description: 'Plastic folder for short documents',
    unit: 'piece',
  },
  {
    id: 'addon-paper-folder-a4',
    name: 'Folder (Paper) - A4',
    price: 5,
    category: 'supplies',
    description: 'Paper folder for A4 size documents',
    unit: 'piece',
  },
  {
    id: 'addon-paper-folder-long',
    name: 'Folder (Paper) - Long',
    price: 5.50,
    category: 'supplies',
    description: 'Paper folder for long documents',
    unit: 'piece',
  },
  {
    id: 'addon-paper-folder-short',
    name: 'Folder (Paper) - Short',
    price: 4.50,
    category: 'supplies',
    description: 'Paper folder for short documents',
    unit: 'piece',
  },
  {
    id: 'addon-envelope-small',
    name: 'Envelope - Small (4x6 in)',
    price: 2,
    category: 'supplies',
    description: 'Small envelope for documents',
    unit: 'piece',
  },
  {
    id: 'addon-envelope-medium',
    name: 'Envelope - Medium (6x9 in)',
    price: 3,
    category: 'supplies',
    description: 'Medium envelope for documents',
    unit: 'piece',
  },
  {
    id: 'addon-envelope-large',
    name: 'Envelope - Large (9x12 in)',
    price: 4,
    category: 'supplies',
    description: 'Large envelope for documents',
    unit: 'piece',
  },
];
