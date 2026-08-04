// Integration utilities for deducting inventory when orders are completed or walk-in transactions are saved

import { inventoryStore } from './inventoryStore';

// Type definitions for order details
type OrderDetails = {
  id: string;
  pages: number;
  copies: number;
  paperSize: string; // 'A4', 'Letter', 'Legal', 'Short', 'Long', etc.
  type: string; // 'B&W' or 'Colored'
  colorMode?: 'bw' | 'color';
  pagesPerSheet?: '1' | '2' | '4';
  addons?: { name: string; quantity: number }[];
};

type WalkInItem = {
  service: string;
  quantity: number;
  itemType: 'service' | 'supply';
};

// Calculate actual pages used based on pagesPerSheet setting
function calculateActualPages(pages: number, pagesPerSheet: string = '1'): number {
  const pps = parseInt(pagesPerSheet);
  return Math.ceil(pages / pps);
}

// Deduct inventory for a completed print order
export function deductInventoryForOrder(order: OrderDetails): boolean {
  const { id, pages, copies, paperSize, type, colorMode, pagesPerSheet = '1', addons = [] } = order;

  // Calculate actual sheets of paper needed (accounting for pagesPerSheet)
  const actualPages = calculateActualPages(pages, pagesPerSheet);
  const totalSheets = actualPages * copies;

  // Determine paper type based on paper size
  let paperItemName = '';
  const paperSizeLower = paperSize.toLowerCase();
  
  if (paperSizeLower === 'a4' || paperSizeLower === 'short' || paperSizeLower === 'letter') {
    paperItemName = 'Bond Paper (A4)';
  } else if (paperSizeLower === 'legal' || paperSizeLower === 'long') {
    paperItemName = 'Bond Paper (Legal)';
  } else if (paperSizeLower === 'a3') {
    paperItemName = 'Bond Paper (A3)';
  } else {
    // Default to A4
    paperItemName = 'Bond Paper (A4)';
  }

  // Deduct paper
  const paperDeducted = inventoryStore.deductQuantity(
    paperItemName,
    'Paper',
    totalSheets,
    `Order ${id} - ${totalSheets} sheets used`,
    id
  );

  if (!paperDeducted) {
    console.error(`Failed to deduct paper for order ${id}`);
    return false;
  }

  // Ink cartridges are manually managed by admin/staff - no automatic deduction

  // Deduct addon supplies
  if (addons && addons.length > 0) {
    addons.forEach(addon => {
      const addonName = addon.name.toLowerCase();
      let inventoryItemName = '';
      let category = 'Add-ons';

      // Map addon names to inventory item names
      if (addonName.includes('stapl')) {
        inventoryItemName = 'Staples';
      } else if (addonName.includes('folder')) {
        if (addonName.includes('plastic')) {
          inventoryItemName = 'Folder (Plastic)';
        } else if (addonName.includes('paper')) {
          inventoryItemName = 'Folder (Paper)';
        }
      } else if (addonName.includes('envelope')) {
        inventoryItemName = 'Envelopes';
      }

      if (inventoryItemName) {
        inventoryStore.deductQuantity(
          inventoryItemName,
          category,
          addon.quantity,
          `Order ${id} - ${addon.name}`,
          id
        );
      }
    });
  }

  return true;
}

// Deduct inventory for a walk-in transaction
export function deductInventoryForWalkIn(
  transactionId: string,
  items: WalkInItem[]
): boolean {
  let allSuccessful = true;

  items.forEach(item => {
    if (item.itemType === 'supply') {
      // Direct supply purchase
      let inventoryItemName = '';
      let category = 'Supplies';

      // Map service names to inventory item names
      if (item.service.toLowerCase().includes('bond paper (short)')) {
        inventoryItemName = 'Bond Paper (A4)';
        category = 'Paper';
      } else if (item.service.toLowerCase().includes('bond paper (long)')) {
        inventoryItemName = 'Bond Paper (Legal)';
        category = 'Paper';
      } else if (item.service.toLowerCase().includes('envelope')) {
        inventoryItemName = 'Envelopes';
      } else if (item.service.toLowerCase().includes('folder')) {
        inventoryItemName = 'Folders';
      }

      if (inventoryItemName) {
        const deducted = inventoryStore.deductQuantity(
          inventoryItemName,
          category,
          item.quantity,
          `Walk-in transaction ${transactionId}`,
          undefined,
          transactionId
        );

        if (!deducted) {
          console.warn(`Failed to deduct ${inventoryItemName} for transaction ${transactionId}`);
          allSuccessful = false;
        }
      }
    } else if (item.itemType === 'service') {
      // Service - need to deduct paper and ink
      const serviceName = item.service.toLowerCase();

      // Determine if printing or photocopying
      if (serviceName.includes('print') || serviceName.includes('photocopy')) {
        let paperItemName = '';
        let isColored = false;

        // Determine paper size and color
        if (serviceName.includes('short') || serviceName.includes('a4')) {
          paperItemName = 'Bond Paper (A4)';
        } else if (serviceName.includes('long') || serviceName.includes('legal')) {
          paperItemName = 'Bond Paper (Legal)';
        } else {
          paperItemName = 'Bond Paper (A4)'; // Default
        }

        isColored = serviceName.includes('color');

        // Deduct paper
        const paperDeducted = inventoryStore.deductQuantity(
          paperItemName,
          'Paper',
          item.quantity,
          `Walk-in transaction ${transactionId} - ${item.service}`,
          undefined,
          transactionId
        );

        if (!paperDeducted) {
          console.warn(`Failed to deduct paper for transaction ${transactionId}`);
          allSuccessful = false;
        }

        // Ink cartridges are manually managed by admin/staff - no automatic deduction
      } else if (serviceName.includes('stapl')) {
        inventoryStore.deductQuantity(
          'Staples',
          'Supplies',
          item.quantity,
          `Walk-in transaction ${transactionId} - Stapling`,
          undefined,
          transactionId
        );
      }
    }
  });

  return allSuccessful;
}

// Check if sufficient inventory is available for an order
export function checkInventoryForOrder(order: OrderDetails): {
  available: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  const { pages, copies, paperSize, type, colorMode, pagesPerSheet = '1' } = order;

  // Calculate actual sheets needed
  const actualPages = calculateActualPages(pages, pagesPerSheet);
  const totalSheets = actualPages * copies;

  // Determine paper type - Use correct inventory names
  let paperItemName = '';
  const paperSizeLower = paperSize.toLowerCase();
  
  if (paperSizeLower === 'a4' || paperSizeLower === 'short' || paperSizeLower === 'letter') {
    paperItemName = 'Bond Paper (A4)';
  } else if (paperSizeLower === 'legal' || paperSizeLower === 'long') {
    paperItemName = 'Bond Paper (Legal)';
  } else if (paperSizeLower === 'a3') {
    paperItemName = 'Bond Paper (A3)';
  } else {
    paperItemName = 'Bond Paper (A4)'; // Default
  }

  // Check paper availability
  const paperItem = inventoryStore.getItemByNameAndCategory(paperItemName, 'Paper');
  if (!paperItem || paperItem.currentStock < totalSheets) {
    missing.push(`${paperItemName} (need ${totalSheets}, have ${paperItem?.currentStock || 0})`);
  }

  // Ink cartridges are manually managed by admin/staff - no automatic check

  return {
    available: missing.length === 0,
    missing,
  };
}