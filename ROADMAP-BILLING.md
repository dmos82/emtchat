# EMTChat Billing & User Management Roadmap

## Overview

This document outlines the enterprise-grade billing, user management, and admin system for EMTChat. The goal is to support multiple user types, usage-based billing, team management, and a comprehensive admin dashboard.

---

## Phase 1: User Types & Role Architecture

### User Roles (RBAC)

| Role | Description | Permissions |
|------|-------------|-------------|
| **Free** | Trial users | 50 queries/month, 1 document, basic chat |
| **Starter** | Individual professionals | 500 queries/month, 10 documents, email support |
| **Pro** | Power users | Unlimited queries, 100 documents, priority support |
| **Team Member** | Part of organization | Inherits team plan limits |
| **Team Admin** | Manages team | + Add/remove members, view team usage |
| **Org Owner** | Organization billing owner | + Billing management, plan changes |
| **Super Admin** | EMTChat staff (godtier) | Full system access, all accounts |

### Database Schema (Proposed)

```sql
-- User roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  permissions JSONB NOT NULL,
  tier_level INTEGER NOT NULL -- 0=free, 1=starter, 2=pro, 3=team, 99=admin
);

-- Users extended
ALTER TABLE users ADD COLUMN role_id UUID REFERENCES user_roles(id);
ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);

-- Organizations (for team plans)
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id),
  stripe_subscription_id VARCHAR(255),
  plan_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  action_type VARCHAR(50) NOT NULL, -- 'query', 'document_upload', 'api_call'
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Monthly usage aggregates
CREATE TABLE usage_monthly (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  month DATE NOT NULL,
  query_count INTEGER DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,
  UNIQUE(user_id, month)
);
```

### Implementation Tasks

- [ ] Create user_roles table with default roles
- [ ] Add role_id to users table
- [ ] Create organizations table for team billing
- [ ] Build role-checking middleware
- [ ] Create permission guards for API routes

---

## Phase 2: Usage Tracking System

### What We Track

| Metric | Description | Billing Impact |
|--------|-------------|----------------|
| **Queries** | Chat messages sent | Primary billing metric |
| **Documents** | Files uploaded | Storage limits |
| **Tokens** | AI tokens consumed | Cost tracking |
| **API Calls** | External API usage | Rate limiting |
| **Storage** | Total document size | Enterprise plans |

### Real-Time Usage Display

```typescript
interface UsageData {
  currentMonth: {
    queries: number;
    queryLimit: number;
    documents: number;
    documentLimit: number;
    tokensUsed: number;
  };
  percentUsed: number;
  daysRemaining: number;
  projectedOverage: boolean;
}
```

### Warning Thresholds

| Usage % | Action |
|---------|--------|
| 50% | In-app notification |
| 75% | Email warning |
| 90% | Prominent banner + email |
| 100% | Soft block + upgrade prompt |
| 110% | Hard block (free tier only) |

### Implementation Tasks

- [ ] Create usage_logs table
- [ ] Build usage tracking middleware
- [ ] Create monthly aggregation job (cron)
- [ ] Build usage dashboard component
- [ ] Implement warning email system
- [ ] Create usage API endpoints

---

## Phase 3: Stripe Billing Integration

### Stripe Products Structure

```
EMTChat Free     - $0/month   - price_free_monthly
EMTChat Starter  - $19/month  - price_starter_monthly
EMTChat Pro      - $49/month  - price_pro_monthly
EMTChat Team     - $39/user/month - price_team_monthly (metered)
EMTChat Enterprise - Custom   - Contact sales
```

### Key Stripe Features to Use

1. **Stripe Billing** - Subscription management
2. **Stripe Customer Portal** - Self-service billing
3. **Stripe Entitlements API** - Feature access control
4. **Stripe Webhooks** - Real-time billing events
5. **Stripe Invoicing** - Automatic invoice generation

### Webhook Events to Handle

```typescript
const STRIPE_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.updated',
  'entitlements.active_entitlement_summary.updated'
];
```

### Implementation Tasks

- [ ] Create Stripe products and prices
- [ ] Build subscription checkout flow
- [ ] Implement webhook handler
- [ ] Create customer portal redirect
- [ ] Build plan upgrade/downgrade logic
- [ ] Implement trial period (14 days)
- [ ] Create billing history page

---

## Phase 4: Team & Organization Management

### Team Features

| Feature | Description |
|---------|-------------|
| **Invite Members** | Email invites with role assignment |
| **Remove Members** | Immediate access revocation |
| **Role Assignment** | Team Admin vs Team Member |
| **Shared Documents** | Organization-wide document access |
| **Usage Dashboard** | Team-wide usage statistics |
| **Billing Management** | Single invoice for all members |

### Organization Settings Page

```
/settings/organization
├── General (name, logo)
├── Members (invite, remove, roles)
├── Billing (plan, payment method, invoices)
├── Usage (team usage dashboard)
└── Security (SSO settings - Enterprise)
```

### Implementation Tasks

- [ ] Create organization settings pages
- [ ] Build member invitation system
- [ ] Implement role assignment UI
- [ ] Create shared document permissions
- [ ] Build team usage dashboard
- [ ] Implement seat-based billing sync with Stripe

---

## Phase 5: Super Admin Dashboard (Godtier)

### Admin Capabilities

| Section | Features |
|---------|----------|
| **User Management** | Search, view, edit, impersonate users |
| **Organization Management** | View all orgs, billing status, usage |
| **Billing Overview** | MRR, churn, revenue by plan |
| **Usage Analytics** | System-wide usage, popular queries |
| **Support Tools** | Reset passwords, extend trials, apply credits |
| **System Health** | API status, error rates, queue status |

### Admin Routes

```
/admin
├── /users - User list with search/filter
│   └── /users/[id] - Individual user detail
├── /organizations - All organizations
│   └── /organizations/[id] - Org detail
├── /billing - Revenue dashboard
│   ├── /billing/subscriptions - Active subs
│   └── /billing/invoices - All invoices
├── /usage - System usage analytics
├── /support - Support tools
└── /system - System health
```

### User Detail View (Admin)

```typescript
interface AdminUserView {
  // Basic Info
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  lastLogin: Date;

  // Role & Plan
  role: UserRole;
  organization?: Organization;
  subscription: StripeSubscription;

  // Usage
  currentMonthUsage: UsageData;
  historicalUsage: UsageData[];

  // Billing
  stripeCustomerId: string;
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];

  // Activity
  recentActivity: ActivityLog[];
  documents: Document[];
}
```

### Implementation Tasks

- [ ] Create admin layout and navigation
- [ ] Build user search and list page
- [ ] Create user detail page with all info
- [ ] Build organization management pages
- [ ] Create revenue/billing dashboard
- [ ] Implement user impersonation (with audit log)
- [ ] Build support tools (trial extension, credits)
- [ ] Create system health monitoring

---

## Phase 6: GKChatty Integration

### Use Cases for GKChatty

| Use Case | Implementation |
|----------|----------------|
| **Billing Notifications** | Store notification templates, query for sending |
| **Usage Reports** | Generate and store monthly usage summaries |
| **Export History** | Store billing export history for retrieval |
| **Admin Notes** | Store admin notes about users/issues |
| **Audit Logs** | Queryable audit trail for compliance |

### Billing Notification Templates

```markdown
# Usage Warning (75%)

Subject: Your EMTChat usage is at 75%

Body:
Hi {{user.name}},

You've used {{usage.queries}} of your {{plan.queryLimit}} monthly queries.

At your current rate, you may exceed your limit before {{billing.periodEnd}}.

Consider upgrading to {{suggestedPlan}} for unlimited queries.

[Upgrade Now] [View Usage]
```

### Monthly Billing Export

```typescript
interface BillingExport {
  month: string; // "2026-01"
  generatedAt: Date;
  summary: {
    totalRevenue: number;
    newSubscriptions: number;
    churn: number;
    mrr: number;
  };
  subscriptions: SubscriptionDetail[];
  invoices: InvoiceDetail[];
}
```

### Implementation Tasks

- [ ] Create GKChatty user for EMTChat billing
- [ ] Upload notification templates
- [ ] Build billing export generator
- [ ] Create export retrieval API
- [ ] Implement admin notes system
- [ ] Build audit log with GKChatty storage

---

## Phase 7: Paywall Implementation

### Access Control Flow

```
User requests /chat or /documents
    │
    ▼
Check authentication
    │
    ├─ Not logged in → Redirect to /auth
    │
    ▼
Check subscription status
    │
    ├─ No subscription → Redirect to /pricing
    │
    ├─ Subscription expired → Show renewal prompt
    │
    ├─ Usage exceeded → Show upgrade prompt
    │
    ▼
Grant access to app
```

### Protected Routes

```typescript
const PROTECTED_ROUTES = [
  '/chat',
  '/documents',
  '/knowledge-base',
  '/settings',
  '/api/chat',
  '/api/documents',
];

const PUBLIC_ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/auth',
  '/signup',
  '/about',
  '/contact',
];
```

### Implementation Tasks

- [ ] Create subscription checking middleware
- [ ] Build paywall redirect logic
- [ ] Create "subscription required" page
- [ ] Implement usage limit enforcement
- [ ] Build upgrade prompts/modals
- [ ] Create trial expiration handling

---

## Implementation Priority

### MVP (Phase 1-2)
1. Basic user roles (Free, Paid, Admin)
2. Usage tracking for queries
3. Simple Stripe checkout
4. Basic admin user list

### Version 2 (Phase 3-4)
5. Full Stripe subscription management
6. Team/organization support
7. Usage warnings and limits
8. Customer portal integration

### Version 3 (Phase 5-7)
9. Full admin dashboard
10. GKChatty integration
11. Advanced analytics
12. Enterprise features (SSO, SCIM)

---

## Technical Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Stripe SDK | Billing | Installed |
| next-auth | Authentication | Need to verify |
| GKChatty MCP | Notifications/exports | Available |
| PostgreSQL | Database | Assumed |
| Resend/SendGrid | Email | Need to add |

---

## Timeline Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | User roles & RBAC | 1 week |
| Phase 2 | Usage tracking | 1 week |
| Phase 3 | Stripe integration | 1-2 weeks |
| Phase 4 | Team management | 1 week |
| Phase 5 | Admin dashboard | 2 weeks |
| Phase 6 | GKChatty integration | 3-5 days |
| Phase 7 | Paywall | 2-3 days |

**Total: 6-8 weeks for full implementation**

---

## FAQ Updates Required

Current marketing claims that need implementation:

| Claim | Status | Phase |
|-------|--------|-------|
| "Change plans anytime" | Not built | Phase 3 |
| "Usage warnings at 75%" | Not built | Phase 2 |
| "50 free queries" | Hardcoded, not enforced | Phase 2 |
| "Team billing" | Not built | Phase 4 |
| "Priority support" | Not built | Phase 3 |

---

## Notes

- Consider using WorkOS for enterprise SSO/SCIM if needed
- Stripe Entitlements API is in beta but powerful for feature gating
- GKChatty can serve as audit log storage for compliance
- Admin impersonation needs strict audit logging
