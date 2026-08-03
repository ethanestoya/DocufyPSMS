import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Boxes,
  Users,
  FileText,
  UserPlus,
  Briefcase,
  User,
  Edit,
  Trash2,
  AlertCircle,
  Archive,
  ArchiveRestore,
  Plus,
  Minus,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { inventoryStore, type InventoryItem } from '../../utils/inventoryStore';

const menuItems = [
  {
    label: "Dashboard",
    path: "/staff/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Orders",
    path: "/staff/queue",
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Walk-in Transactions",
    path: "/staff/walk-in",
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    label: "Payment Verification",
    path: "/staff/payment-verification",
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: "Inventory",
    path: "/staff/inventory",
    icon: <Boxes className="w-5 h-5" />,
  },
];

export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [itemToArchive, setItemToArchive] = useState<string | null>(null);
  const [editingItem, setEditingItem] =
    useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    itemName: "",
    category: "",
    newCategory: "",
    subCategory: "",
    quantityAdded: 0,
    adjustmentType: "add" as "add" | "reduce",
  });
  const [isCreatingNewItem, setIsCreatingNewItem] = useState(false);
  const [showArchivedItems, setShowArchivedItems] = useState(false);

  // Load inventory from store on mount and subscribe to changes
  useEffect(() => {
    setInventory(inventoryStore.getItems());

    const unsubscribe = inventoryStore.subscribe(() => {
      setInventory(inventoryStore.getItems());
    });

    return unsubscribe;
  }, []);

  // Category options
  const categoryOptions = {
    Paper: ['Short Bond', 'Long Bond', 'Colored Paper', 'Photo Paper', 'Cardstock'],
    Supplies: ['Staples', 'Binding Covers', 'Folders', 'Envelopes', 'Fasteners'],
    Ink: ['Black Ink Cartridge', 'Colored Ink Cartridge', 'Toner Cartridge'],
  };

  // Filter inventory based on archived status
  const filteredInventory = inventory.filter((item) => {
    const matchesArchivedStatus = showArchivedItems ? item.archived === true : !item.archived;
    return matchesArchivedStatus;
  });

  // Calculate totals based on filtered data
  const totalItems = inventory.length; // Total items doesn't change with filter
  const totalAdded = filteredInventory.reduce(
    (sum, item) => sum + item.quantityAdded,
    0,
  );
  const totalSold = filteredInventory.reduce(
    (sum, item) => sum + item.quantitySold,
    0,
  );
  const remainingStock = totalAdded - totalSold;

  const handleAddItem = () => {
    setEditingItem(null);
    setIsCreatingNewItem(false);
    setFormData({
      itemName: "",
      category: "",
      newCategory: "",
      subCategory: "",
      quantityAdded: 0,
      adjustmentType: "add",
    });
    setIsModalOpen(true);
  };

  const handleCreateNewItem = () => {
    setEditingItem(null);
    setIsCreatingNewItem(true);
    setFormData({
      itemName: "",
      category: "",
      newCategory: "",
      subCategory: "",
      quantityAdded: 0,
      adjustmentType: "add",
    });
    setIsModalOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setIsCreatingNewItem(false);
    setFormData({
      itemName: item.itemName,
      category: item.category,
      newCategory: "",
      subCategory: "",
      quantityAdded: 0,
      adjustmentType: "add",
    });
    setIsModalOpen(true);
  };

  const handleArchiveItem = (id: string) => {
    setItemToArchive(id);
    setShowArchiveDialog(true);
  };

  const confirmArchive = () => {
    if (itemToArchive !== null) {
      inventoryStore.archiveItem(itemToArchive);
      toast.success("Item archived successfully");
    }
    setShowArchiveDialog(false);
    setItemToArchive(null);
  };

  const handleUnarchiveItem = (id: string) => {
    inventoryStore.unarchiveItem(id);
    toast.success("Item restored from archive");
  };

  const handleSaveItem = () => {
    // Validate form data
    if (isCreatingNewItem) {
      if (!formData.itemName.trim()) {
        toast.error("Please enter an item name");
        return;
      }
      if (!formData.category.trim() && !formData.newCategory.trim()) {
        toast.error("Please select or create a category");
        return;
      }
    } else {
      if ((!formData.category || !formData.subCategory) && !editingItem) {
        toast.error("Please select a category and item");
        return;
      }
    }

    // For editing items with reduce, validate quantity
    if (editingItem && formData.adjustmentType === "reduce") {
      const currentStock = editingItem.quantityAdded - (editingItem.quantitySold || 0);
      if (formData.quantityAdded > currentStock) {
        toast.error(`Cannot reduce by ${formData.quantityAdded}. Current stock is only ${currentStock}`);
        return;
      }
    }

    setShowSaveDialog(true);
  };

  const confirmSave = () => {
    if (editingItem) {
      // Update existing item - add or reduce quantity
      if (formData.adjustmentType === "add") {
        inventoryStore.addQuantity(
          editingItem.id,
          formData.quantityAdded,
          `Added ${formData.quantityAdded} units`
        );
        toast.success("Inventory updated successfully");
      } else {
        const success = inventoryStore.reduceQuantity(
          editingItem.id,
          formData.quantityAdded,
          `Reduced by ${formData.quantityAdded} units`
        );
        if (success) {
          toast.success("Inventory updated successfully");
        } else {
          toast.error("Failed to reduce quantity. Please check available stock.");
        }
      }
    } else {
      // Determine category name - use new category if provided
      const categoryName = formData.newCategory.trim() || formData.category;

      // Determine item name
      const itemName = isCreatingNewItem
        ? formData.itemName
        : formData.subCategory;

      // Check if item already exists
      const existingItem = inventoryStore.getItemByNameAndCategory(itemName, categoryName);

      if (existingItem) {
        // Add to existing item
        inventoryStore.addQuantity(
          existingItem.id,
          formData.quantityAdded,
          `Added ${formData.quantityAdded} units`
        );
        toast.success("Inventory updated successfully");
      } else {
        // Add new item
        inventoryStore.addItem({
          itemName: itemName,
          category: categoryName,
          quantityAdded: formData.quantityAdded,
          quantitySold: 0,
          dateAdded: new Date(),
          archived: false,
        });
        toast.success("Item added successfully");
      }
    }
    setShowSaveDialog(false);
    setIsModalOpen(false);
    setIsCreatingNewItem(false);
  };

  const handleInputChange = (
    field: string,
    value: string | number,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Layout menuItems={menuItems} title="Inventory" showBackButton>
      <div className="space-y-6">
        {/* Add Item Buttons */}
        <div className="flex gap-3 justify-between">
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleAddItem}
              className="bg-[#1D73EC] hover:bg-[#10316B] text-white rounded-lg px-6"
            >
              Add to Existing Item
            </Button>
            <Button
              type="button"
              onClick={handleCreateNewItem}
              variant="outline"
              className="border-[#1D73EC] text-[#1D73EC] hover:bg-[#F2F7FF] rounded-lg px-6"
            >
              Create New Item
            </Button>
          </div>
          <Button
            type="button"
            onClick={() => setShowArchivedItems(!showArchivedItems)}
            variant="outline"
            className={`rounded-lg px-6 ${
              showArchivedItems
                ? "border-blue-500 text-blue-600 hover:bg-white border-2 border-blue-200"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Archive className="w-4 h-4 mr-2" />
            {showArchivedItems ? "Hide Archived" : "Show Archived"}
          </Button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-[#1c1f26] text-3xl font-semibold">
            Inventory
          </h1>
        </div>

        {/* Low Stock Alert */}
        {(() => {
          const lowStockItems = filteredInventory.filter(item => {
            const currentStock = item.quantityAdded - item.quantitySold;
            const reorderLevel = item.reorderLevel || 0;
            return currentStock <= reorderLevel;
          });

          return lowStockItems.length > 0 ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-5 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-amber-900 mb-1">
                    Stock Alert: {lowStockItems.length} Item{lowStockItems.length > 1 ? 's' : ''} Need Attention
                  </h3>
                  <p className="text-sm text-amber-700 mb-3">
                    The following items have reached or fallen below their minimum reorder threshold and require restocking:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {lowStockItems.map(item => {
                      const currentStock = item.quantityAdded - item.quantitySold;
                      const isCritical = currentStock <= (item.reorderLevel || 0) * 0.5;
                      return (
                        <div key={item.id} className="bg-white border border-amber-200 rounded px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-amber-900">{item.itemName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${isCritical ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                              {isCritical ? 'Critical' : 'Low'}
                            </span>
                          </div>
                          <div className="text-xs text-amber-700 mt-1">
                            Current: <strong>{currentStock}</strong> / Minimum: <strong>{item.reorderLevel || 0}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null;
        })()}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl text-[#1c1f26] mt-1">
              {totalItems}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Total Added</p>
            <p className="text-2xl text-[#1c1f26] mt-1">
              {totalAdded}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Total Sold</p>
            <p className="text-2xl text-[#1c1f26] mt-1">
              {totalSold}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">
              Remaining Stock
            </p>
            <p className="text-2xl text-[#1c1f26] mt-1">
              {remainingStock}
            </p>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F2F7FF]">
                <tr>
                  <th className="text-left py-3 px-4 text-[#1c1f26]">
                    Item Name
                  </th>
                  <th className="text-left py-3 px-4 text-[#1c1f26]">
                    Category
                  </th>
                  <th className="text-left py-3 px-4 text-[#1c1f26]">
                    Quantity Added
                  </th>
                  <th className="text-left py-3 px-4 text-[#1c1f26]">
                    Quantity Sold
                  </th>
                  <th className="text-left py-3 px-4 text-[#1c1f26]">
                    Current Stock
                  </th>
                  <th className="text-left py-3 px-4 text-[#1c1f26]">
                    Reorder Level
                  </th>
                  <th className="text-left py-3 px-4 text-[#1c1f26]">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-[#1c1f26]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const currentStock = item.quantityAdded - item.quantitySold;
                  const reorderLevel = item.reorderLevel || 0;
                  const isCritical = currentStock <= reorderLevel * 0.5;
                  const isLowStock = currentStock <= reorderLevel && !isCritical;
                  const stockStatus = isCritical ? 'Critical Stock' : isLowStock ? 'Low Stock' : 'In Stock';
                  const statusColor = isCritical
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : isLowStock
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-green-100 text-green-800 border border-green-300';

                  return (
                    <tr
                      key={item.id}
                      className="border-t border-gray-200 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-[#1c1f26]">
                        {item.itemName}
                        {(isCritical || isLowStock) && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span className="text-xs text-amber-600">
                              {isCritical ? 'Action Required' : 'Restock Soon'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {item.category}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {item.quantityAdded}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {item.quantitySold}
                      </td>
                      <td className="py-3 px-4">
                        <span className={isCritical ? 'text-red-600 font-semibold' : isLowStock ? 'text-amber-600 font-semibold' : 'text-[#1c1f26]'}>
                          {currentStock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {reorderLevel || 'Not set'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                          {isCritical && <AlertCircle className="w-3 h-3" />}
                          {stockStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {!item.archived && (
                            <button
                              onClick={() => handleEditItem(item)}
                              className="p-2 text-[#1D73EC] hover:bg-[#F2F7FF] rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {item.archived ? (
                            <button
                              onClick={() => handleUnarchiveItem(item.id)}
                              className="p-2 text-blue-600 hover:bg-white border-2 border-blue-200 rounded transition-colors"
                              title="Restore"
                            >
                              <ArchiveRestore className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchiveItem(item.id)}
                              className="p-2 text-blue-600 hover:bg-white border-2 border-blue-200 rounded transition-colors"
                              title="Archive"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Item Modal */}
        <Dialog
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        >
          <DialogContent className="bg-white sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-[#1c1f26]">
                {editingItem ? 'Edit Inventory' : (isCreatingNewItem ? 'Create New Item' : 'Add to Existing Item')}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingItem ? 'Form to edit inventory item.' : (isCreatingNewItem ? 'Form to create a new inventory item.' : 'Form to add to existing inventory.')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Category Selection or Creation */}
              {isCreatingNewItem ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-[#1c1f26]">Existing Category (Optional)</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => {
                        handleInputChange('category', value);
                        handleInputChange('newCategory', '');
                      }}
                    >
                      <SelectTrigger className="bg-white border-gray-300">
                        <SelectValue placeholder="Select existing category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paper">Paper</SelectItem>
                        <SelectItem value="Supplies">Supplies</SelectItem>
                        <SelectItem value="Ink">Ink</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!formData.category && (
                    <div className="space-y-2">
                      <Label htmlFor="newCategory" className="text-[#1c1f26]">Or Create New Category *</Label>
                      <Input
                        id="newCategory"
                        value={formData.newCategory}
                        onChange={(e) => {
                          handleInputChange('newCategory', e.target.value);
                          handleInputChange('category', '');
                        }}
                        className="bg-white border-gray-300"
                        placeholder="Enter new category name"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="itemName" className="text-[#1c1f26]">Item Name *</Label>
                    <Input
                      id="itemName"
                      value={formData.itemName}
                      onChange={(e) => handleInputChange('itemName', e.target.value)}
                      className="bg-white border-gray-300"
                      placeholder="Enter new item name"
                    />
                  </div>
                </>
              ) : !editingItem ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-[#1c1f26]">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => {
                        handleInputChange('category', value);
                        handleInputChange('subCategory', '');
                      }}
                    >
                      <SelectTrigger className="bg-white border-gray-300">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paper">Paper</SelectItem>
                        <SelectItem value="Supplies">Supplies</SelectItem>
                        <SelectItem value="Ink">Ink</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.category && (
                    <div className="space-y-2">
                      <Label htmlFor="subCategory" className="text-[#1c1f26]">Item *</Label>
                      <Select
                        value={formData.subCategory}
                        onValueChange={(value) => handleInputChange('subCategory', value)}
                      >
                        <SelectTrigger className="bg-white border-gray-300">
                          <SelectValue placeholder="Select an item" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions[formData.category as keyof typeof categoryOptions]?.map((item) => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : null}

              {editingItem && (
                <>
                  <div className="p-3 bg-white border-2 border-blue-200 border border-green-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>Editing:</strong> {editingItem.itemName} ({editingItem.category})
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Current stock: {editingItem.quantityAdded - (editingItem.quantitySold || 0)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1c1f26]">Adjustment Type *</Label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleInputChange('adjustmentType', 'add')}
                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                          formData.adjustmentType === 'add'
                            ? 'border-blue-500 bg-white border-2 border-blue-200 text-blue-700'
                            : 'border-gray-300 hover:border-blue-300'
                        }`}
                      >
                        <Plus className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-sm font-medium">Add Quantity</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputChange('adjustmentType', 'reduce')}
                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                          formData.adjustmentType === 'reduce'
                            ? 'border-blue-500 bg-white border-2 border-blue-200 text-red-500'
                            : 'border-gray-300 hover:border-blue-300'
                        }`}
                      >
                        <Minus className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-sm font-medium">Reduce Quantity</p>
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="quantityAdded" className="text-[#1c1f26]">
                  {editingItem
                    ? (formData.adjustmentType === 'add' ? 'Quantity to Add *' : 'Quantity to Reduce *')
                    : 'Quantity *'}
                </Label>
                <Input
                  id="quantityAdded"
                  type="number"
                  min="0"
                  value={formData.quantityAdded}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                    handleInputChange('quantityAdded', isNaN(val) ? 0 : val);
                  }}
                  className="bg-white border-gray-300"
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveItem}
                className="bg-[#1D73EC] hover:bg-[#10316B] text-white"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save Confirmation Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-[#1D73EC]" />
                </div>
                <DialogTitle className="text-xl text-[#1c1f26]">
                  {editingItem ? "Update Item?" : "Add Item?"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-base">
                {editingItem
                  ? "Are you sure you want to save the changes to this inventory item?"
                  : "Are you sure you want to add this new item to the inventory?"}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmSave}
                className="bg-[#1D73EC] hover:bg-[#10316B] text-white"
              >
                {editingItem ? "Update Item" : "Add Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Archive Confirmation Dialog */}
        <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Archive className="w-6 h-6 text-blue-600" />
                </div>
                <DialogTitle className="text-xl text-[#1c1f26]">Archive Item?</DialogTitle>
              </div>
              <DialogDescription className="text-base">
                Are you sure you want to archive this inventory item? You can restore it later from the archived items view.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowArchiveDialog(false)}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmArchive}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Archive Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}