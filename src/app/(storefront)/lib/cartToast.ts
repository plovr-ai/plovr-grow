import { toast } from "sonner";

/**
 * Show a toast notification when an item is added to cart.
 * Can be used from any entry point (featured items, promotions, etc.)
 *
 * @param itemName - The name of the item added to cart
 * @param quantity - The quantity added (default: 1)
 */
export function showCartToast(itemName: string, quantity: number = 1) {
  const message =
    quantity > 1
      ? `${quantity}x ${itemName} added to cart`
      : `${itemName} added to cart`;
  toast.success(message);
}
