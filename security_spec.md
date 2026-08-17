# Security Specification - QRSavour

## 1. Data Invariants
- **Categories**: Must have a name and an icon string. Read-only for public.
- **MenuItems**: Must belong to an existing category. Read-only for public.
- **Orders**:
  - Must have a valid `tableNumber` (1-100).
  - `status` can only be `pending` on creation.
  - `createdAt` must match server time.
  - `items` array cannot be empty.
  - `total` must be correctly calculated based on items (though this is hard to verify in rules without complex math, we will at least check it's a number).
  - Only authenticated staff can read all orders or update status. Customers can only create (blind write).

## 2. Dirty Dozen Payloads (Expected to be DENIED)
1. **Unauthenticated Read of Orders**: Trying to list `/orders`.
2. **Order with Invalid Status**: Creating an order with `status: 'done'`.
3. **Order with Spoofed Time**: Creating an order with a past/future `createdAt`.
4. **Invalid Table Number**: `tableNumber: -1` or `9999`.
5. **Admin Field Injection**: Adding `isAdmin: true` to an order.
6. **Modifying an Order as Customer**: Attempting to `update` an order's status after it's been placed.
7. **Deleting an Order**: No one should delete orders except maybe super-admin (blocked by default).
8. **Malicious ID Poisoning**: Document ID with 2KB junk string.
9. **Category Write by Public**: Attempting to create a category as anonymous.
10. **Menu Item Price Update by Public**: Attempting to change prices.
11. **Huge Order Payload**: 5MB order object.
12. **Status Skipping**: Moving an order from `pending` directly to `done` without `preparing` (state machine lock).

## 3. Test Scenarios (Simplified)
- `create` order -> `pending` -> Success
- `create` order -> `done` -> Denied
- `update` order -> `preparing` -> ONLY enabled for "staff" (in this app, we'll allow anyone for demo, but secure it with a logic gate).
