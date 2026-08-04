// Centralized order counter with persistence
// Ensures sequential and consistent order numbering across sessions

const ORDER_COUNTER_KEY = 'docufy_order_counter';
const ORDER_PREFIX = 'ORD-';

class OrderCounter {
  private currentCounter: number;

  constructor() {
    // Initialize counter from localStorage or start from 0
    const stored = localStorage.getItem(ORDER_COUNTER_KEY);
    if (stored) {
      this.currentCounter = parseInt(stored, 10);
      if (isNaN(this.currentCounter)) {
        this.currentCounter = 0;
      }
    } else {
      this.currentCounter = 0;
    }
  }

  /**
   * Initialize the counter based on existing orders
   * This should be called once when the app starts to sync with existing data
   * It ensures the counter starts at the highest existing order number
   */
  initializeFromOrders(orderIds: string[]): void {
    // If localStorage has a counter, trust it (it's already been initialized)
    const stored = localStorage.getItem(ORDER_COUNTER_KEY);
    if (stored && parseInt(stored, 10) > 0) {
      // Counter already initialized from previous session
      // Still check if any order numbers are higher (in case of manual data edits)
      if (orderIds.length === 0) {
        return;
      }
    }

    if (orderIds.length === 0) {
      // No orders exist, start from 0 (next order will be ORD-001)
      if (!stored) {
        this.currentCounter = 0;
        this.persist();
      }
      return;
    }

    // Extract numeric parts from all order IDs and find the highest
    const orderNumbers = orderIds
      .map(orderId => {
        const match = orderId.match(/ORD-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num) && num > 0);

    if (orderNumbers.length > 0) {
      const maxNumber = Math.max(...orderNumbers);
      // Update if the max from orders is higher than current counter
      // This handles cases where orders were imported or manually created
      if (maxNumber > this.currentCounter) {
        this.currentCounter = maxNumber;
        this.persist();
      }
    }
  }

  /**
   * Get the next sequential order ID and increment the counter
   */
  getNextOrderId(): string {
    this.currentCounter += 1;
    this.persist();
    return `${ORDER_PREFIX}${this.currentCounter.toString().padStart(3, '0')}`;
  }

  /**
   * Get the current counter value without incrementing
   */
  getCurrentCounter(): number {
    return this.currentCounter;
  }

  /**
   * Manually set the counter (use with caution)
   * This should only be used for admin operations or data migration
   */
  setCounter(value: number): void {
    if (value >= 0) {
      this.currentCounter = value;
      this.persist();
    }
  }

  /**
   * Persist the current counter to localStorage
   */
  private persist(): void {
    localStorage.setItem(ORDER_COUNTER_KEY, this.currentCounter.toString());
  }

  /**
   * Reset the counter (use with extreme caution - only for testing/development)
   */
  reset(): void {
    this.currentCounter = 0;
    this.persist();
  }
}

// Export a singleton instance
export const orderCounter = new OrderCounter();

// Export the class for testing purposes
export { OrderCounter };
