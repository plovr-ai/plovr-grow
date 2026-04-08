"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MenuItemPickerModal } from "./MenuItemPickerModal";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/utils";
import type { CateringOrderItem } from "@/services/catering/catering-order.types";

interface MenuInfo {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName: string;
  menuId: string;
}

interface Merchant {
  id: string;
  name: string;
  currency: string;
  locale: string;
}

interface CateringOrderFormProps {
  merchants: Merchant[];
  selectedMerchantId: string;
  menus: MenuInfo[];
  menuItems: MenuItem[];
  leadId?: string;
  initialEventDate?: string;
  initialData?: {
    customerFirstName: string;
    customerLastName: string;
    customerPhone: string;
    customerEmail: string;
  };
}

export function CateringOrderForm({
  merchants,
  selectedMerchantId,
  menus,
  menuItems,
  leadId,
  initialEventDate,
  initialData,
}: CateringOrderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [merchantId, setMerchantId] = useState(selectedMerchantId);

  // Customer info
  const [customerFirstName, setCustomerFirstName] = useState(initialData?.customerFirstName ?? "");
  const [customerLastName, setCustomerLastName] = useState(initialData?.customerLastName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialData?.customerPhone ?? "");
  const [customerEmail, setCustomerEmail] = useState(initialData?.customerEmail ?? "");

  // Event details
  const [eventDate, setEventDate] = useState(initialEventDate ?? "");
  const [eventTime, setEventTime] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [notes, setNotes] = useState("");

  // Order items
  const [items, setItems] = useState<CateringOrderItem[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Get current merchant
  const currentMerchant = merchants.find((m) => m.id === merchantId) || merchants[0];

  // Calculate totals
  // TODO: Use tax-config system for proper tax calculation
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxAmount = 0;
  const totalAmount = subtotal + taxAmount;

  const handleAddItem = () => {
    if (menuItems.length === 0) return;
    setEditingItemIndex(null);
    setIsPickerOpen(true);
  };

  const handleEditItem = (index: number) => {
    setEditingItemIndex(index);
    setIsPickerOpen(true);
  };

  const handleItemSelect = (selectedItemsFromModal: Array<{ item: MenuItem; quantity: number }>) => {
    if (editingItemIndex !== null) {
      // Edit mode: single item replacement
      const { item: selectedItem } = selectedItemsFromModal[0];
      const newItems = [...items];
      const existingItem = newItems[editingItemIndex];
      existingItem.menuItemId = selectedItem.id;
      existingItem.name = selectedItem.name;
      existingItem.unitPrice = selectedItem.price;
      existingItem.totalPrice = selectedItem.price * existingItem.quantity;
      setItems(newItems);
    } else {
      // Add mode: batch add items with quantities
      const newItems = selectedItemsFromModal.map(({ item, quantity }) => ({
        menuItemId: item.id,
        name: item.name,
        quantity,
        unitPrice: item.price,
        totalPrice: item.price * quantity,
      }));
      setItems([...items, ...newItems]);
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    const item = newItems[index];

    if (field === "menuItemId") {
      const menuItem = menuItems.find((m) => m.id === value);
      if (menuItem) {
        item.menuItemId = menuItem.id;
        item.name = menuItem.name;
        item.unitPrice = menuItem.price;
        item.totalPrice = menuItem.price * item.quantity;
      }
    } else if (field === "quantity") {
      const qty = Math.max(1, parseInt(value as string) || 1);
      item.quantity = qty;
      item.totalPrice = item.unitPrice * qty;
    } else if (field === "unitPrice") {
      const price = Math.max(0, parseFloat(value as string) || 0);
      item.unitPrice = price;
      item.totalPrice = price * item.quantity;
    }

    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (sendInvoice: boolean) => {
    // Validate required fields
    if (!customerFirstName || !customerLastName || !customerPhone || !customerEmail) {
      alert("Please fill in all customer information");
      return;
    }
    if (!eventDate || !eventTime || !guestCount) {
      alert("Please fill in event details");
      return;
    }
    if (items.length === 0) {
      alert("Please add at least one item");
      return;
    }

    setLoading(true);
    try {
      // Create the order
      const response = await fetch(`/api/dashboard/${merchantId}/catering/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerFirstName,
          customerLastName,
          customerPhone,
          customerEmail,
          eventDate,
          eventTime,
          guestCount: parseInt(guestCount),
          eventType: eventType || undefined,
          eventAddress: eventAddress || undefined,
          specialRequests: specialRequests || undefined,
          notes: notes || undefined,
          items,
          subtotal,
          taxAmount,
          totalAmount,
          leadId: leadId || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create order");
      }

      const { data } = await response.json();
      const orderId = data.order.id;

      // Optionally send invoice
      if (sendInvoice) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);

        await fetch(`/api/dashboard/${merchantId}/catering/orders/${orderId}/send-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dueDate: dueDate.toISOString() }),
        });
      }

      // Redirect to orders list
      router.push("/dashboard/catering/orders");
      router.refresh();
    } catch (error) {
      console.error("Error creating order:", error);
      alert(error instanceof Error ? error.message : "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const priceFormatter = (price: number) =>
    formatPrice(price, currentMerchant?.currency || "USD", currentMerchant?.locale || "en-US");

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Merchant Selection */}
      {merchants.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold mb-4">Location</h3>
          <Select
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            className="max-w-md"
          >
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Customer Information */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-4">Customer Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={customerFirstName}
              onChange={(e) => setCustomerFirstName(e.target.value)}
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={customerLastName}
              onChange={(e) => setCustomerLastName(e.target.value)}
              placeholder="Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
        </div>
      </div>

      {/* Event Details */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-4">Event Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Time <span className="text-red-500">*</span>
            </label>
            <Input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Guests <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min="1"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Type
            </label>
            <Select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="">Select type...</option>
              <option value="corporate">Corporate Event</option>
              <option value="wedding">Wedding</option>
              <option value="birthday">Birthday Party</option>
              <option value="graduation">Graduation</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Address
            </label>
            <Input
              value={eventAddress}
              onChange={(e) => setEventAddress(e.target.value)}
              placeholder="123 Main St, City, State 12345"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Requests
            </label>
            <Textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Dietary restrictions, setup requirements, etc."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Order Items</h3>
          <Button variant="outline" size="sm" onClick={handleAddItem}>
            <Plus className="mr-1 h-4 w-4" />
            Add Item
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No items added yet. Click &ldquo;Add Item&rdquo; to start.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => handleEditItem(index)}
                    className="w-full text-left px-3 py-2 border rounded-md bg-white hover:bg-gray-50 truncate text-sm"
                  >
                    {item.name}
                  </button>
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                    placeholder="Qty"
                  />
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                    placeholder="Price"
                  />
                </div>
                <div className="w-32 text-right font-medium">
                  {priceFormatter(item.totalPrice)}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        {items.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{priceFormatter(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span>{priceFormatter(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{priceFormatter(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-4">Internal Notes</h3>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for your team (not visible to customer)"
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={loading || items.length === 0}
        >
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Saving..." : "Save as Draft"}
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={loading || items.length === 0}
        >
          <Send className="mr-2 h-4 w-4" />
          {loading ? "Creating..." : "Create & Send Invoice"}
        </Button>
      </div>

      {/* Menu Item Picker Modal */}
      <MenuItemPickerModal
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setEditingItemIndex(null);
        }}
        onSelect={handleItemSelect}
        menus={menus}
        menuItems={menuItems}
        formatPrice={priceFormatter}
        mode={editingItemIndex !== null ? "single" : "multi"}
        selectedItemId={
          editingItemIndex !== null ? items[editingItemIndex]?.menuItemId : undefined
        }
      />
    </div>
  );
}
