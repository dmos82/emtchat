# EMTChat Subscription Flow Test Plan

**Version:** 1.0
**Date:** 2026-01-13
**Status:** Draft

---

## Overview

This document outlines the comprehensive test plan for EMTChat's subscription and payment system, covering user signup flows, Stripe integration, webhook handling, subscription management, usage limits, and edge cases.

---

## Test Environment Setup

### Prerequisites

```bash
# 1. Backend running
cd /Users/davidmini/Desktop/Projects/EMTChat/emtchat-deploy/backend
npm run dev  # Port 4001

# 2. Frontend running
cd /Users/davidmini/Desktop/Projects/EMTChat/emtchat-deploy/frontend
npm run dev  # Port 3000

# 3. MongoDB running
mongosh  # Verify connection

# 4. Stripe CLI installed and authenticated
stripe --version
stripe login

# 5. Webhook forwarding active
stripe listen --forward-to http://localhost:4001/api/webhooks/stripe
```

### Test Stripe Cards

| Card Number | Purpose | Expected Result |
|-------------|---------|-----------------|
| `4242 4242 4242 4242` | Success | Payment succeeds |
| `4000 0000 0000 0002` | Decline | Payment declined |
| `4000 0000 0000 9995` | Insufficient funds | Payment fails |
| `4000 0025 0000 3155` | 3D Secure required | Triggers auth flow |

**Test Details:**
- Any future expiration date (e.g., `12/34`)
- Any 3-digit CVC (e.g., `123`)
- Any billing ZIP code (e.g., `12345`)

---

## 1. New User Signup Flow

### Test Case 1.1: Free Tier Signup (No Payment)

**Objective:** Verify users can sign up for free tier without payment.

**Steps:**
1. Navigate to `/signup`
2. Fill in:
   - Email: `test-free-{timestamp}@example.com`
   - Password: `Test123!@#`
   - Confirm Password: `Test123!@#`
3. Click "Sign Up"
4. Verify redirect to `/dashboard`

**Expected Results:**
- ✅ User created in `users` collection
- ✅ User document has `tier: 'free'`
- ✅ User document has `stripeCustomerId: null`
- ✅ No Subscription document created
- ✅ Dashboard shows "Free Plan"
- ✅ Usage shows `0 / 50 queries`

**Database Verification:**
```bash
mongosh emtchat
db.users.findOne({ email: "test-free-{timestamp}@example.com" })
# Expected:
# {
#   email: "test-free-{timestamp}@example.com",
#   tier: "free",
#   stripeCustomerId: null,
#   createdAt: ISODate(...),
#   updatedAt: ISODate(...)
# }
```

**API Test:**
```bash
# Get user after signup
curl http://localhost:4001/api/auth/me \
  -H "Cookie: connect.sid={SESSION_ID}"

# Expected response:
{
  "user": {
    "email": "test-free-{timestamp}@example.com",
    "tier": "free",
    "stripeCustomerId": null
  }
}
```

---

### Test Case 1.2: Paid Tier Signup (Stripe Checkout)

**Objective:** Verify users can sign up for paid tier via Stripe checkout.

**Steps:**
1. Navigate to `/pricing`
2. Click "Subscribe" on Basic Plan ($9.99/month)
3. Redirected to Stripe Checkout
4. Fill in test card: `4242 4242 4242 4242`
5. Complete payment
6. Verify redirect to `/success?session_id={SESSION_ID}`
7. Click "Go to Dashboard"
8. Verify dashboard shows "Basic Plan"

**Expected Results:**
- ✅ User created in `users` collection with `tier: 'basic'`
- ✅ `stripeCustomerId` populated
- ✅ Subscription document created in `subscriptions` collection
- ✅ Subscription has `status: 'active'`
- ✅ Success page shows payment confirmation
- ✅ Dashboard shows "Basic Plan"
- ✅ Usage shows `0 / 500 queries`

**Database Verification:**
```bash
mongosh emtchat

# Check user
db.users.findOne({ email: "test-basic-{timestamp}@example.com" })
# Expected:
# {
#   email: "test-basic-{timestamp}@example.com",
#   tier: "basic",
#   stripeCustomerId: "cus_XXXXXXXXXX",
#   createdAt: ISODate(...),
#   updatedAt: ISODate(...)
# }

# Check subscription
db.subscriptions.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# Expected:
# {
#   userId: ObjectId("..."),
#   stripeCustomerId: "cus_XXXXXXXXXX",
#   stripeSubscriptionId: "sub_XXXXXXXXXX",
#   status: "active",
#   currentPeriodEnd: ISODate(...),
#   cancelAtPeriodEnd: false,
#   createdAt: ISODate(...),
#   updatedAt: ISODate(...)
# }
```

**Stripe Dashboard Verification:**
1. Go to https://dashboard.stripe.com/test/customers
2. Search for customer by email
3. Verify subscription exists and is active
4. Verify payment succeeded

---

### Test Case 1.3: Premium Tier Signup

**Objective:** Verify premium tier signup flow.

**Steps:**
1. Navigate to `/pricing`
2. Click "Subscribe" on Premium Plan ($29.99/month)
3. Complete Stripe checkout with `4242 4242 4242 4242`
4. Verify redirect to success page
5. Navigate to dashboard

**Expected Results:**
- ✅ User has `tier: 'premium'`
- ✅ Subscription created with correct plan
- ✅ Dashboard shows "Premium Plan"
- ✅ Usage shows `0 / 2000 queries`

---

## 2. Stripe Checkout

### Test Case 2.1: Successful Payment Flow

**Objective:** Verify complete successful payment flow from pricing to dashboard.

**Steps:**
1. Start at `/pricing`
2. Click "Subscribe" on any paid plan
3. Fill in Stripe checkout:
   - Email: `test-success-{timestamp}@example.com`
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `12345`
4. Click "Subscribe"
5. Wait for redirect

**Expected Results:**
- ✅ Redirected to `/success?session_id={SESSION_ID}`
- ✅ Success page displays:
   - "Payment successful!"
   - Session ID
   - "Go to Dashboard" button
- ✅ Dashboard accessible
- ✅ User can immediately use paid features

**Browser Console Check:**
```javascript
// Should show no errors
// Network tab should show:
// - POST /api/create-checkout-session → 200
// - Redirect to checkout.stripe.com
// - Redirect to /success?session_id=...
// - GET /api/auth/me → 200 (with paid tier)
```

---

### Test Case 2.2: Canceled Payment Flow

**Objective:** Verify user flow when payment is canceled.

**Steps:**
1. Start at `/pricing`
2. Click "Subscribe" on any paid plan
3. On Stripe checkout page, click browser back button OR close tab
4. Verify redirect to `/pricing?canceled=true`

**Expected Results:**
- ✅ Redirected to `/pricing` with query param `canceled=true`
- ✅ Message displayed: "Payment was canceled. You can try again anytime."
- ✅ No user created in database
- ✅ No subscription created
- ✅ User can retry payment

**URL Test:**
```bash
# Manually test canceled URL
open http://localhost:3000/pricing?canceled=true

# Expected: Banner/toast message about cancellation
```

---

### Test Case 2.3: Payment Declined

**Objective:** Verify handling of declined payments.

**Steps:**
1. Start at `/pricing`
2. Click "Subscribe"
3. Use declined test card: `4000 0000 0000 0002`
4. Complete checkout

**Expected Results:**
- ✅ Stripe shows error: "Your card was declined"
- ✅ User remains on Stripe checkout
- ✅ User can retry with different card
- ✅ No user/subscription created until successful payment

---

### Test Case 2.4: 3D Secure Authentication

**Objective:** Verify 3D Secure card authentication flow.

**Steps:**
1. Start at `/pricing`
2. Click "Subscribe"
3. Use 3DS test card: `4000 0025 0000 3155`
4. Complete initial form
5. Verify 3DS modal appears
6. Click "Complete" or "Fail" in test modal

**Expected Results:**
- ✅ 3DS modal appears
- ✅ Successful auth → payment succeeds
- ✅ Failed auth → payment fails, user can retry
- ✅ Webhook fires after successful auth

---

## 3. Webhook Handling

### Test Case 3.1: webhook Setup and Listening

**Objective:** Verify Stripe webhook endpoint is accessible and processing events.

**Setup:**
```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start Stripe CLI listener
stripe listen --forward-to http://localhost:4001/api/webhooks/stripe

# Expected output:
# > Ready! Your webhook signing secret is whsec_XXXXXXXXXX
# Save this secret to backend/.env as STRIPE_WEBHOOK_SECRET
```

**Environment Variable:**
```bash
# backend/.env
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXX
```

**Test Webhook Endpoint:**
```bash
# Test webhook endpoint is accessible
curl -X POST http://localhost:4001/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"ping"}'

# Expected: 400 (invalid signature) - this means endpoint exists
```

---

### Test Case 3.2: checkout.session.completed Event

**Objective:** Verify subscription creation when checkout completes.

**Steps:**
1. Ensure Stripe CLI is listening
2. Complete a successful checkout (Test Case 2.1)
3. Monitor webhook logs

**Expected Webhook Event:**
```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_XXXXXXXXXX",
      "customer": "cus_XXXXXXXXXX",
      "subscription": "sub_XXXXXXXXXX",
      "status": "complete",
      "payment_status": "paid"
    }
  }
}
```

**Expected Backend Logs:**
```
[Webhook] Received: checkout.session.completed
[Webhook] Customer ID: cus_XXXXXXXXXX
[Webhook] Subscription ID: sub_XXXXXXXXXX
[Webhook] Creating subscription in database...
[Webhook] Subscription created successfully
```

**Expected Database Changes:**
```bash
mongosh emtchat
db.subscriptions.findOne({ stripeSubscriptionId: "sub_XXXXXXXXXX" })
# Expected:
# {
#   userId: ObjectId("..."),
#   stripeCustomerId: "cus_XXXXXXXXXX",
#   stripeSubscriptionId: "sub_XXXXXXXXXX",
#   status: "active",
#   currentPeriodEnd: ISODate(...),
#   cancelAtPeriodEnd: false,
#   createdAt: ISODate(...),
#   updatedAt: ISODate(...)
# }

db.users.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# Expected:
# {
#   ...,
#   tier: "basic" | "premium",
#   stripeCustomerId: "cus_XXXXXXXXXX"
# }
```

**Manual Webhook Trigger:**
```bash
# Trigger test webhook event
stripe trigger checkout.session.completed

# Monitor webhook listener terminal for event processing
```

---

### Test Case 3.3: customer.subscription.updated Event

**Objective:** Verify subscription updates are synced to database.

**Steps:**
1. Ensure Stripe CLI is listening
2. Manually update subscription in Stripe Dashboard
3. Monitor webhook logs

**Manual Trigger:**
```bash
stripe trigger customer.subscription.updated

# Expected webhook event processed
# Expected database updated
```

**Database Verification:**
```bash
mongosh emtchat
db.subscriptions.findOne({ stripeSubscriptionId: "sub_XXXXXXXXXX" })
# Verify status, currentPeriodEnd, cancelAtPeriodEnd fields updated
```

---

### Test Case 3.4: customer.subscription.deleted Event

**Objective:** Verify subscription cancellation is synced to database.

**Steps:**
1. Create active subscription
2. Cancel subscription in Stripe Dashboard
3. Monitor webhook event

**Expected Results:**
- ✅ Webhook event `customer.subscription.deleted` received
- ✅ Subscription status updated to `canceled` in database
- ✅ User tier downgraded to `free`
- ✅ User can no longer access paid features

**Manual Trigger:**
```bash
stripe trigger customer.subscription.deleted

# Monitor webhook logs
```

**Database Verification:**
```bash
mongosh emtchat
db.subscriptions.findOne({ stripeSubscriptionId: "sub_XXXXXXXXXX" })
# Expected: { status: "canceled" }

db.users.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# Expected: { tier: "free" }
```

---

### Test Case 3.5: invoice.payment_failed Event

**Objective:** Verify handling of failed subscription payments.

**Steps:**
1. Trigger payment failure event
2. Verify user notification (if implemented)
3. Verify subscription status updated

**Manual Trigger:**
```bash
stripe trigger invoice.payment_failed

# Monitor webhook logs
```

**Expected Results:**
- ✅ Subscription status updated to `past_due`
- ✅ User receives notification (email or in-app)
- ✅ User prompted to update payment method
- ✅ Access continues for grace period (if implemented)

---

## 4. Subscription Management

### Test Case 4.1: View Current Plan

**Objective:** Verify users can view their current subscription details.

**Steps:**
1. Login as user with active subscription
2. Navigate to `/dashboard` or `/account`
3. Locate subscription section

**Expected Results:**
- ✅ Current plan name displayed (Free, Basic, Premium)
- ✅ Current period end date displayed (paid plans)
- ✅ Subscription status (Active, Canceled, Past Due)
- ✅ "Manage Subscription" button visible (paid plans)
- ✅ "Upgrade" button visible (free or lower tiers)

**UI Elements to Verify:**
```
┌─────────────────────────────────┐
│ Current Plan: Basic             │
│ Status: Active                  │
│ Renews: January 13, 2027        │
│                                 │
│ [Manage Subscription]           │
│ [Upgrade to Premium]            │
└─────────────────────────────────┘
```

---

### Test Case 4.2: Upgrade via Stripe Portal

**Objective:** Verify users can upgrade their subscription.

**Steps:**
1. Login as Basic tier user
2. Click "Manage Subscription" button
3. Redirected to Stripe Customer Portal
4. Click "Update plan"
5. Select Premium plan
6. Confirm upgrade
7. Return to dashboard

**Expected Results:**
- ✅ Redirected to `billing.stripe.com/p/session/...`
- ✅ Stripe portal shows current subscription
- ✅ Can select higher tier plan
- ✅ Prorated charge calculated correctly
- ✅ After upgrade, webhook fires
- ✅ Database updated with new tier
- ✅ Dashboard reflects new plan immediately

**Webhook Event:**
```json
{
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_XXXXXXXXXX",
      "items": {
        "data": [
          {
            "price": {
              "id": "price_premium_XXXXXXXXXX"
            }
          }
        ]
      }
    }
  }
}
```

**Database Verification:**
```bash
mongosh emtchat
db.users.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# Expected: { tier: "premium" }
```

---

### Test Case 4.3: Downgrade via Stripe Portal

**Objective:** Verify users can downgrade their subscription.

**Steps:**
1. Login as Premium tier user
2. Click "Manage Subscription"
3. In Stripe portal, click "Update plan"
4. Select Basic plan
5. Confirm downgrade
6. Return to dashboard

**Expected Results:**
- ✅ Downgrade scheduled for end of current period
- ✅ Dashboard shows: "Downgrade scheduled for [date]"
- ✅ User retains Premium access until period ends
- ✅ At period end, webhook fires
- ✅ User downgraded to Basic tier
- ✅ Usage limits updated

**Stripe Portal UI:**
```
Your plan will change to Basic on January 13, 2027
You'll keep your Premium benefits until then.
```

---

### Test Case 4.4: Cancel Subscription

**Objective:** Verify users can cancel their subscription.

**Steps:**
1. Login as paid tier user
2. Click "Manage Subscription"
3. In Stripe portal, click "Cancel plan"
4. Confirm cancellation
5. Return to dashboard

**Expected Results:**
- ✅ Cancellation scheduled for end of period
- ✅ Dashboard shows: "Subscription ends on [date]"
- ✅ User retains paid access until period ends
- ✅ At period end, webhook fires
- ✅ User downgraded to Free tier
- ✅ Subscription status updated to `canceled`

**Database Verification:**
```bash
mongosh emtchat
db.subscriptions.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# Expected:
# {
#   status: "active",
#   cancelAtPeriodEnd: true,
#   currentPeriodEnd: ISODate("2027-01-13")
# }

# After period ends:
# {
#   status: "canceled",
#   cancelAtPeriodEnd: false
# }
```

---

### Test Case 4.5: Reactivate Canceled Subscription

**Objective:** Verify users can reactivate a canceled subscription before period ends.

**Steps:**
1. Login as user with canceled subscription (before period end)
2. Click "Manage Subscription"
3. In Stripe portal, click "Resume subscription"
4. Confirm reactivation
5. Return to dashboard

**Expected Results:**
- ✅ Cancellation removed
- ✅ Subscription continues at period end
- ✅ Webhook fires: `customer.subscription.updated`
- ✅ Database updated: `cancelAtPeriodEnd: false`
- ✅ Dashboard no longer shows cancellation notice

---

## 5. Usage Limits

### Test Case 5.1: Free User Hits 50 Query Limit

**Objective:** Verify free users are blocked at 50 queries.

**Steps:**
1. Login as free tier user
2. Make 50 queries via chat interface
3. Attempt 51st query

**Expected Results:**
- ✅ Query 1-50: Successful responses
- ✅ Dashboard shows: "49 / 50 queries used"
- ✅ Query 51: Error message displayed
- ✅ Error message: "You've reached your free plan limit. Upgrade to continue."
- ✅ "Upgrade" button shown
- ✅ No query sent to API

**API Test:**
```bash
# Simulate 51st query
curl -X POST http://localhost:4001/api/chat/query \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid={FREE_USER_SESSION}" \
  -d '{"message":"Test query 51"}'

# Expected response:
{
  "error": "Usage limit reached. Please upgrade your plan.",
  "code": "USAGE_LIMIT_REACHED"
}
```

---

### Test Case 5.2: Paid User Has Higher Limit

**Objective:** Verify paid users have correct usage limits.

**Steps:**
1. Login as Basic tier user (500 limit)
2. Check dashboard usage display
3. Make multiple queries
4. Verify counter increments

**Expected Results:**
- ✅ Dashboard shows: "0 / 500 queries"
- ✅ After query 1: "1 / 500 queries"
- ✅ After query 50: "50 / 500 queries"
- ✅ No blocking until 500 queries

**Premium Tier Test:**
1. Login as Premium tier user (2000 limit)
2. Verify dashboard shows: "0 / 2000 queries"

**Database Query:**
```bash
mongosh emtchat
db.users.aggregate([
  { $match: { tier: "basic" } },
  { $lookup: {
      from: "queries",
      localField: "_id",
      foreignField: "userId",
      as: "queries"
  }},
  { $project: {
      email: 1,
      tier: 1,
      queryCount: { $size: "$queries" },
      limit: 500
  }}
])
```

---

### Test Case 5.3: Warning Shows at 75% Usage

**Objective:** Verify users receive warning when approaching limit.

**Steps:**
1. Login as free tier user
2. Make 38 queries (76% of 50)
3. Check for warning message

**Expected Results:**
- ✅ Dashboard shows warning banner
- ✅ Warning text: "You've used 38 of 50 queries (76%). Consider upgrading."
- ✅ "Upgrade" button in banner
- ✅ Warning persists until upgrade or limit hit

**Warning Thresholds:**

| Tier | Limit | 75% | 90% | 100% |
|------|-------|-----|-----|------|
| Free | 50 | 38 | 45 | 50 |
| Basic | 500 | 375 | 450 | 500 |
| Premium | 2000 | 1500 | 1800 | 2000 |

**API Test:**
```bash
curl http://localhost:4001/api/auth/me \
  -H "Cookie: connect.sid={SESSION_ID}"

# Expected response:
{
  "user": {
    "email": "user@example.com",
    "tier": "free",
    "usage": {
      "current": 38,
      "limit": 50,
      "percentage": 76,
      "warning": true
    }
  }
}
```

---

### Test Case 5.4: Usage Resets on Subscription Renewal

**Objective:** Verify usage counter resets at subscription renewal.

**Steps:**
1. Login as paid user with usage > 0
2. Note current usage count
3. Simulate subscription renewal (manual or wait for actual renewal)
4. Check usage counter

**Expected Results:**
- ✅ Before renewal: "450 / 500 queries"
- ✅ After renewal: "0 / 500 queries"
- ✅ Historical usage logged (if implemented)

**Manual Simulation:**
```bash
# Update subscription's currentPeriodEnd to trigger renewal webhook
# This requires Stripe CLI and webhook listener
stripe trigger customer.subscription.updated

# Or directly in database (for testing only):
mongosh emtchat
db.subscriptions.updateOne(
  { stripeCustomerId: "cus_XXXXXXXXXX" },
  {
    $set: {
      currentPeriodEnd: new Date(Date.now() + 30*24*60*60*1000)
    }
  }
)

# Reset usage counter (would normally be done by webhook handler)
db.usage.deleteMany({ userId: ObjectId("..."), period: "current" })
```

---

## 6. Edge Cases

### Test Case 6.1: User Pays but Webhook Fails

**Objective:** Verify system handles webhook delivery failures gracefully.

**Scenario:**
- User completes Stripe checkout successfully
- Payment goes through
- Webhook endpoint is down or times out
- Subscription not created in database

**Steps:**
1. Stop backend server (simulate webhook failure)
2. Complete Stripe checkout
3. Payment succeeds
4. Start backend server
5. User tries to login

**Expected Results:**
- ✅ Payment succeeded in Stripe
- ✅ Customer exists in Stripe
- ✅ Subscription active in Stripe
- ✅ User created with `stripeCustomerId` (from checkout session metadata)
- ✅ Subscription missing from local database
- ✅ Backend detects mismatch on user login
- ✅ Backend makes Stripe API call to fetch subscription
- ✅ Subscription synced to database
- ✅ User gains access to paid features

**Recovery Code Test:**
```javascript
// In backend: /api/auth/me route
app.get('/api/auth/me', async (req, res) => {
  const user = await User.findById(req.session.userId);

  // If user has stripeCustomerId but no subscription in DB
  if (user.stripeCustomerId && user.tier !== 'free') {
    const subscription = await Subscription.findOne({
      stripeCustomerId: user.stripeCustomerId
    });

    if (!subscription) {
      // RECOVERY: Fetch from Stripe and sync
      const stripeSubscription = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
        limit: 1
      });

      if (stripeSubscription.data.length > 0) {
        // Create missing subscription
        await Subscription.create({
          userId: user._id,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.data[0].id,
          status: 'active',
          currentPeriodEnd: new Date(stripeSubscription.data[0].current_period_end * 1000)
        });
      }
    }
  }

  res.json({ user });
});
```

**Manual Verification:**
1. Check Stripe Dashboard for active subscription
2. Check local database for missing subscription
3. Trigger recovery by hitting `/api/auth/me` endpoint
4. Verify subscription now exists in database

---

### Test Case 6.2: User Cancels Mid-Cycle

**Objective:** Verify user retains access until period end when canceling mid-cycle.

**Steps:**
1. User subscribes on January 1
2. User cancels on January 15
3. Subscription period ends February 1

**Expected Results:**
- ✅ January 15: Webhook `customer.subscription.updated` fires
- ✅ Subscription updated: `cancelAtPeriodEnd: true`
- ✅ User tier remains paid (basic/premium)
- ✅ Dashboard shows: "Subscription ends on February 1, 2026"
- ✅ User retains full access until February 1
- ✅ February 1: Webhook `customer.subscription.deleted` fires
- ✅ User tier updated to `free`
- ✅ Subscription status updated to `canceled`

**Timeline Test:**
```
Jan 1  - Subscription starts
         status: active, cancelAtPeriodEnd: false

Jan 15 - User cancels
         status: active, cancelAtPeriodEnd: true
         ✅ User still has access

Feb 1  - Period ends
         status: canceled, cancelAtPeriodEnd: false
         ✅ User downgraded to free
```

**Database Check:**
```bash
# January 15 (after cancel, before period end)
mongosh emtchat
db.subscriptions.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# Expected:
# {
#   status: "active",
#   cancelAtPeriodEnd: true,
#   currentPeriodEnd: ISODate("2026-02-01")
# }

db.users.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# Expected: { tier: "basic" }  // Still paid!

# February 1 (after period end)
db.subscriptions.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# Expected:
# {
#   status: "canceled",
#   cancelAtPeriodEnd: false
# }

db.users.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# Expected: { tier: "free" }  // Now downgraded
```

---

### Test Case 6.3: Payment Fails on Renewal

**Objective:** Verify system handles failed renewal payments correctly.

**Scenario:**
- User has active subscription
- Renewal date arrives
- Payment fails (expired card, insufficient funds, etc.)

**Steps:**
1. User has active subscription expiring soon
2. Update payment method to declined card in Stripe
3. Wait for renewal attempt OR trigger manually
4. Monitor webhook events

**Expected Webhook Events:**
```json
{
  "type": "invoice.payment_failed",
  "data": {
    "object": {
      "subscription": "sub_XXXXXXXXXX",
      "attempt_count": 1
    }
  }
}
```

**Expected Results:**
- ✅ Webhook `invoice.payment_failed` fires
- ✅ Subscription status updated to `past_due`
- ✅ User receives notification (email from Stripe)
- ✅ Dashboard shows warning: "Payment failed. Please update payment method."
- ✅ User retains access for grace period (configurable in Stripe)
- ✅ Stripe automatically retries payment (Smart Retries)
- ✅ After final retry fails: Subscription canceled
- ✅ User downgraded to free tier

**Manual Trigger:**
```bash
stripe trigger invoice.payment_failed

# Monitor webhook logs
# Check database for status update
```

**Grace Period Test:**
```
Day 0  - Payment fails
         status: past_due
         ✅ User still has access

Day 7  - Second retry fails
         status: past_due
         ✅ User still has access

Day 14 - Final retry fails
         status: canceled
         ✅ User downgraded to free
```

**Database States:**
```bash
# After first failure
db.subscriptions.findOne({ stripeSubscriptionId: "sub_XXXXXXXXXX" })
# { status: "past_due" }

db.users.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# { tier: "basic" }  // Still has access

# After final failure
db.subscriptions.findOne({ stripeSubscriptionId: "sub_XXXXXXXXXX" })
# { status: "canceled" }

db.users.findOne({ stripeCustomerId: "cus_XXXXXXXXXX" })
# { tier: "free" }  // Access revoked
```

---

### Test Case 6.4: Duplicate Webhook Events

**Objective:** Verify system handles duplicate webhook deliveries (Stripe retries).

**Scenario:**
- Webhook endpoint responds slowly
- Stripe retries webhook delivery
- Same event processed twice

**Expected Results:**
- ✅ First event processed successfully
- ✅ Second event detected as duplicate (idempotency check)
- ✅ Second event ignored
- ✅ No duplicate subscriptions created
- ✅ No duplicate charges

**Idempotency Implementation:**
```javascript
// In webhook handler
app.post('/api/webhooks/stripe', async (req, res) => {
  const event = req.body;

  // Check if event already processed
  const existingEvent = await ProcessedEvent.findOne({
    eventId: event.id
  });

  if (existingEvent) {
    console.log(`[Webhook] Duplicate event ${event.id}, ignoring`);
    return res.json({ received: true });
  }

  // Process event
  await handleWebhookEvent(event);

  // Record as processed
  await ProcessedEvent.create({
    eventId: event.id,
    type: event.type,
    processedAt: new Date()
  });

  res.json({ received: true });
});
```

**Test:**
```bash
# Send same webhook event twice
stripe trigger checkout.session.completed
stripe trigger checkout.session.completed

# Check database
mongosh emtchat
db.subscriptions.countDocuments({ stripeSubscriptionId: "sub_XXXXXXXXXX" })
# Expected: 1 (not 2)

db.processedevents.find({ type: "checkout.session.completed" }).count()
# Expected: 1 (duplicate ignored)
```

---

### Test Case 6.5: User Has Multiple Active Subscriptions (Error Case)

**Objective:** Verify system prevents/handles multiple active subscriptions for one user.

**Scenario:**
- User subscribes to Basic plan
- Without canceling, user subscribes to Premium plan
- Two active subscriptions exist in Stripe

**Expected Results:**
- ✅ System detects duplicate subscription attempt
- ✅ Previous subscription automatically canceled
- ✅ User only has one active subscription
- ✅ User tier reflects most recent subscription

**Prevention Code:**
```javascript
app.post('/api/create-checkout-session', async (req, res) => {
  const user = await User.findById(req.session.userId);

  // Check for existing active subscriptions
  if (user.stripeCustomerId) {
    const existingSubs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active'
    });

    if (existingSubs.data.length > 0) {
      // Cancel existing subscription before creating new one
      await stripe.subscriptions.cancel(existingSubs.data[0].id);
    }
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({...});
  res.json({ url: session.url });
});
```

---

### Test Case 6.6: Subscription in Stripe but User Deleted from Database

**Objective:** Verify orphaned Stripe subscriptions are handled correctly.

**Scenario:**
- User has active subscription in Stripe
- User account deleted from database (manual deletion or data cleanup)
- Webhook events continue firing for this user

**Expected Results:**
- ✅ Webhook handler detects missing user
- ✅ Log warning about orphaned subscription
- ✅ Optionally cancel Stripe subscription
- ✅ No errors thrown

**Handler Code:**
```javascript
async function handleSubscriptionUpdated(event) {
  const subscription = event.data.object;

  // Find user by Stripe customer ID
  const user = await User.findOne({
    stripeCustomerId: subscription.customer
  });

  if (!user) {
    console.warn(`[Webhook] Orphaned subscription ${subscription.id} - user not found`);

    // Optional: Cancel orphaned subscription
    await stripe.subscriptions.cancel(subscription.id);
    return;
  }

  // Normal processing
  await updateSubscription(user, subscription);
}
```

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Backend server running (port 4001)
- [ ] Frontend server running (port 3000)
- [ ] MongoDB running and accessible
- [ ] Stripe CLI installed and authenticated
- [ ] Stripe webhook listener running
- [ ] `.env` files configured with Stripe keys
- [ ] Test user accounts created

### Section 1: New User Signup Flow
- [ ] Test Case 1.1: Free tier signup
- [ ] Test Case 1.2: Paid tier signup (Basic)
- [ ] Test Case 1.3: Paid tier signup (Premium)

### Section 2: Stripe Checkout
- [ ] Test Case 2.1: Successful payment flow
- [ ] Test Case 2.2: Canceled payment flow
- [ ] Test Case 2.3: Payment declined
- [ ] Test Case 2.4: 3D Secure authentication

### Section 3: Webhook Handling
- [ ] Test Case 3.1: Webhook setup and listening
- [ ] Test Case 3.2: checkout.session.completed
- [ ] Test Case 3.3: customer.subscription.updated
- [ ] Test Case 3.4: customer.subscription.deleted
- [ ] Test Case 3.5: invoice.payment_failed

### Section 4: Subscription Management
- [ ] Test Case 4.1: View current plan
- [ ] Test Case 4.2: Upgrade via Stripe portal
- [ ] Test Case 4.3: Downgrade via Stripe portal
- [ ] Test Case 4.4: Cancel subscription
- [ ] Test Case 4.5: Reactivate canceled subscription

### Section 5: Usage Limits
- [ ] Test Case 5.1: Free user hits 50 query limit
- [ ] Test Case 5.2: Paid user has higher limit
- [ ] Test Case 5.3: Warning shows at 75% usage
- [ ] Test Case 5.4: Usage resets on renewal

### Section 6: Edge Cases
- [ ] Test Case 6.1: User pays but webhook fails
- [ ] Test Case 6.2: User cancels mid-cycle
- [ ] Test Case 6.3: Payment fails on renewal
- [ ] Test Case 6.4: Duplicate webhook events
- [ ] Test Case 6.5: Multiple active subscriptions
- [ ] Test Case 6.6: Orphaned Stripe subscriptions

---

## Automated Test Scripts

### Script 1: Complete Signup and Payment Flow

```bash
#!/bin/bash
# test-signup-flow.sh

echo "=== Testing Complete Signup Flow ==="

# 1. Generate unique test email
TIMESTAMP=$(date +%s)
TEST_EMAIL="test-auto-$TIMESTAMP@example.com"

echo "Test email: $TEST_EMAIL"

# 2. Create user via signup API
curl -X POST http://localhost:4001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$TEST_EMAIL"'",
    "password": "Test123!@#"
  }' \
  -c cookies.txt

# 3. Verify user created
mongosh emtchat --eval "db.users.findOne({ email: '$TEST_EMAIL' })"

# 4. Create checkout session
SESSION_RESPONSE=$(curl -X POST http://localhost:4001/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "priceId": "price_basic_XXXXXXXXXX"
  }')

echo "Checkout session: $SESSION_RESPONSE"

# 5. Manual step: Complete Stripe checkout
echo "Please complete checkout at the URL above"
echo "Press Enter when done..."
read

# 6. Verify subscription created
mongosh emtchat --eval "db.subscriptions.findOne({ userId: ... })"

echo "=== Test Complete ==="
```

### Script 2: Usage Limit Test

```bash
#!/bin/bash
# test-usage-limits.sh

echo "=== Testing Usage Limits ==="

# 1. Login as free user
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "free-user@example.com",
    "password": "Test123!@#"
  }' \
  -c cookies.txt

# 2. Make 51 queries
for i in {1..51}; do
  RESPONSE=$(curl -X POST http://localhost:4001/api/chat/query \
    -H "Content-Type: application/json" \
    -b cookies.txt \
    -d '{
      "message": "Test query '$i'"
    }')

  echo "Query $i: $RESPONSE"

  if [[ $RESPONSE == *"USAGE_LIMIT_REACHED"* ]]; then
    echo "✅ Limit enforced at query $i"
    break
  fi
done

echo "=== Test Complete ==="
```

---

## Success Criteria

### All Tests Pass
- ✅ All 30+ test cases executed
- ✅ No critical failures
- ✅ All edge cases handled gracefully
- ✅ Database consistency maintained
- ✅ Stripe integration working correctly

### Performance
- ✅ Webhook processing < 500ms
- ✅ Checkout session creation < 1s
- ✅ User dashboard loads < 2s

### User Experience
- ✅ Clear error messages
- ✅ Smooth payment flow
- ✅ Intuitive subscription management
- ✅ Transparent usage tracking

---

## Appendix

### Useful Commands

```bash
# Check Stripe webhook logs
stripe logs tail

# List all customers
stripe customers list

# List all subscriptions
stripe subscriptions list

# Get specific subscription
stripe subscriptions retrieve sub_XXXXXXXXXX

# Cancel subscription
stripe subscriptions cancel sub_XXXXXXXXXX

# Create test payment
stripe payment_intents create --amount=999 --currency=usd

# MongoDB queries
mongosh emtchat
db.users.find().pretty()
db.subscriptions.find().pretty()
db.queries.aggregate([
  { $group: { _id: "$userId", count: { $sum: 1 } } }
])
```

### Environment Variables Reference

```bash
# backend/.env
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXX
STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXX
STRIPE_PRICE_BASIC=price_XXXXXXXXXX
STRIPE_PRICE_PREMIUM=price_XXXXXXXXXX
```

### Stripe Dashboard Sections

- **Customers:** https://dashboard.stripe.com/test/customers
- **Subscriptions:** https://dashboard.stripe.com/test/subscriptions
- **Payments:** https://dashboard.stripe.com/test/payments
- **Webhooks:** https://dashboard.stripe.com/test/webhooks
- **Logs:** https://dashboard.stripe.com/test/logs

---

**Document Status:** Ready for Review
**Next Steps:** Execute test cases and document results
**Owner:** QA Team
**Last Updated:** 2026-01-13
