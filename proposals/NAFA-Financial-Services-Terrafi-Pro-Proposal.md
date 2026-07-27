# Proposal: Agent Network Management for MyNafa Wallet

**Prepared for:** NAFA Financial Services  
**Prepared by:** Terrafi Pro  
**Date:** 26 July 2026  
**Subject:** Terrafi Pro — Agent Network Operations Platform  
**Validity:** 60 days from the date above  

---

## 1. Executive summary

NAFA Financial Services has built MyNafa Wallet into a licensed Gambian mobile-money and remittance channel serving customers across The Gambia and multiple African corridors. As the wallet and agent footprint grow, the operational challenge shifts from *moving money* to *running the network*: knowing which outlets are visited, which agents are liquid, which KYC files are audit-ready, and which field officers are covering which zones.

**Terrafi Pro** is the agent network control tower that sits beside MyNafa Wallet. It does not replace your core wallet, remittance rails, or customer app. It gives NAFA’s managers, regional leads, and field officers one workspace for:

- GPS-verified field visits  
- Agent float and cash visibility  
- KYC document collection and review  
- Performance coaching across ADRs and agents  
- Role-based access that matches how a real operator is organised  

This proposal outlines how Terrafi Pro can strengthen MyNafa’s agent channel — from onboarding and compliance through day-to-day float health and field supervision.

---

## 2. Understanding NAFA’s opportunity

From public positioning and market context, NAFA operates as:

- A **licensed Gambian MTO** with MyNafa Wallet as a mobile financial services channel  
- A network that depends on **agents, sub-agents, and partner outlets** for cash-in, cash-out, and customer reach  
- An operator expanding **coverage and trust** in line with financial inclusion goals  

Typical pressures at this stage include:

| Challenge | Impact without a dedicated ops system |
|-----------|----------------------------------------|
| Field coverage is hard to prove | Visits reported verbally or on paper; weak accountability |
| Agent liquidity is reactive | Low-float outlets discovered after customer complaints |
| KYC at scale | Documents scattered across WhatsApp, email, and folders |
| Multi-role coordination | Managers, leads, ADRs, agents, and tellers share spreadsheets |
| Growth across zones | No single map of outlets, competitors, or visit targets |

Terrafi Pro is built specifically for these operator problems.

---

## 3. Proposed solution

### 3.1 Positioning

| Layer | System | Role |
|-------|--------|------|
| Customer & money movement | **MyNafa Wallet** (existing) | Send/receive, bills, airtime, cashpower, remittances |
| Agent network operations | **Terrafi Pro** (proposed) | Visits, float health, KYC, performance, network visibility |

Terrafi Pro complements MyNafa. Your wallet remains the source of truth for transactions; Terrafi Pro becomes the source of truth for **how the agent network is supervised and grown**.

### 3.2 What NAFA would gain

1. **Verified field presence** — Officers check in within ~50 metres of the agent location; coverage becomes measurable.  
2. **Float awareness** — Monitor e-float and cash per agent and zone; surface low-float risk early.  
3. **Compliance readiness** — Upload, queue, approve, or reject KYC documents with a clear audit trail.  
4. **One organisation model** — Network managers, internal users, team leads, field officers (ADRs), agents, and tellers each see what they need.  
5. **Operational map** — Agents, zones, outlet context, and competitor/branding notes in one place.  
6. **Field-ready access** — Responsive web app with PWA install and offline visit queue for officers in low-connectivity areas.

---

## 4. Scope of capabilities

### 4.1 Included in the proposed deployment

| Capability | Description |
|------------|-------------|
| **Company workspace** | Dedicated multi-tenant environment for NAFA; data isolated from other operators |
| **Agent directory** | Create/edit agents; outlet details; phones; GPS; location photo; bulk CSV import |
| **Network map** | Map view of agents and zones for coverage planning |
| **Field visits** | Schedule and log visits with GPS check-in and compliance checklist |
| **Offline visit queue** | Queue visits when offline; sync when connectivity returns |
| **Float monitor** | Per-agent e-float & cash, zone totals, trends, low-float alerts |
| **Float sync (optional)** | Secure ingest of agent balance snapshots from your reporting/core systems |
| **KYC / compliance** | Document upload (JPEG, PNG, WebP, PDF), review queue, approve/reject, stats |
| **Performance** | ADR and agent trends to support coaching |
| **Training tracking** | Assign modules and track completion / pass rates |
| **Users & roles** | Invite staff; role-based access control |
| **Audit log** | Organisation-scoped activity history |
| **Notifications** | In-app alerts for operational events (e.g. low float) |
| **Settings & branding** | Float thresholds, visit targets, zones, business types, company branding |
| **Exports** | Operational data export for reporting and oversight |
| **Onboarding support** | Guided setup of company, roles, and initial agent/user imports |

### 4.2 Out of scope (clarified)

Terrafi Pro does **not**:

- Process end-customer wallet transfers, cash-in/cash-out, or remittance payouts  
- Replace MyNafa Wallet, banking integrations, or NAFA’s core transaction systems  
- Act as a consumer-facing app for MyNafa customers  

Those remain NAFA’s systems of record. Integration is focused on **agent float visibility and operational workflows**, not on replacing the wallet core.

---

## 5. Recommended commercial package

Subscription plans are priced in **Gambian Dalasi (GMD)**, billed monthly or quarterly (3 months upfront).

| Plan | Team seats | Monthly (GMD) | Quarterly (GMD) | Best fit |
|------|------------|---------------|-----------------|----------|
| **Basic** | Up to 25 | 26,590 | 79,770 | Growing networks getting started |
| **Standard** | Up to 50 | 31,590 | 94,770 | Mid-size field teams *(recommended starting point)* |
| **Unlimited** | Unlimited | 50,590 | 151,770 | Large networks with no seat ceiling |

### Plan highlights

**Basic** — Agent directory & map, GPS field visits, float monitoring, KYC queue, email support  

**Standard** — Everything in Basic, plus performance & ADR insights, bulk import & KYC tools, audit log, priority support  

**Unlimited** — Everything in Standard, plus unlimited seats, full platform capacity, dedicated onboarding help, priority support  

### Recommendation for NAFA

We recommend starting on **Standard** (or **Unlimited** if NAFA expects more than 50 internal/field users in the first year). This covers performance insights, bulk tools, and audit logging — typically required once a licensed MTO’s agent channel is under active management.

Seat limits apply to **team users** (managers, leads, ADRs, internal staff). Agent and teller access is managed within the operator workspace as part of network operations.

*Commercial terms can be adjusted for a pilot, multi-year agreement, or volume commitment — see Section 8.*

---

## 6. Implementation approach

| Phase | Timing (indicative) | Activities |
|-------|---------------------|------------|
| **1. Kick-off** | Week 1 | Confirm stakeholders, roles, zones, success metrics; provision NAFA workspace |
| **2. Configuration** | Weeks 1–2 | Branding, float thresholds, visit targets, business types, user invites |
| **3. Data load** | Weeks 2–3 | Agent import (CSV), map locations, assign field officers |
| **4. Float link (optional)** | Weeks 2–4 | Secure float snapshot integration with NAFA / partner reporting systems |
| **5. Pilot** | Weeks 3–5 | One or two regions live; GPS visits + KYC + float monitoring |
| **6. Rollout** | Weeks 5–8 | Expand zones; training; tune alerts and visit targets |
| **7. Steady state** | Ongoing | Priority support; quarterly review of network health metrics |

**Access model:** Secure cloud-hosted SaaS (responsive web + installable PWA). No native app store dependency for field officers.

**Security posture:** Multi-tenant isolation, JWT authentication, role-based access, organisation audit logs. Float ingest (where enabled) uses authenticated, signed, and encrypted delivery.

---

## 7. Expected outcomes for NAFA

Within the first 60–90 days of active use, NAFA should be able to demonstrate:

- A live **agent directory and map** for participating zones  
- **GPS-verified visit records** instead of unverifiable field reports  
- A working **KYC review queue** with clear approve/reject history  
- **Low-float visibility** for managers before customer friction peaks  
- Role-appropriate dashboards for HQ, regional leads, and ADRs  

These outcomes support MyNafa’s growth story: stronger agent discipline, cleaner compliance posture, and clearer evidence of network coverage for leadership and regulators.

---

## 8. Commercial options & next steps

### Option A — Standard subscription (recommended)

- Plan: **Standard**  
- Billing: Monthly **GMD 31,590** or Quarterly **GMD 94,770**  
- Includes priority support and full Standard feature set  

### Option B — Unlimited subscription

- Plan: **Unlimited**  
- Billing: Monthly **GMD 50,590** or Quarterly **GMD 151,770**  
- Includes dedicated onboarding help and no seat ceiling  

### Option C — Structured pilot (available on request)

- Fixed-scope pilot (e.g. 1–2 regions, 30–60 days)  
- Convert to Standard or Unlimited at agreed commercial rates  
- Success criteria defined jointly at kick-off  

### Proposed next steps

1. **Discovery call** (45–60 minutes) — Confirm agent count, regions, roles, and float data sources  
2. **Live demo** tailored to MyNafa’s agent / ADR / manager workflows  
3. **Pilot or subscription agreement** — Select plan and go-live window  
4. **Kick-off** — Provision workspace and begin configuration  

---

## 9. Why Terrafi Pro for NAFA

- Built for **mobile-money agent networks**, not generic CRM  
- Designed around **Gambian operator realities**: zones, ADRs, float, KYC, field connectivity  
- Clear boundary with MyNafa Wallet — we strengthen the **agent channel**, you keep the **money movement**  
- Ready for commercial deployment with SaaS billing, multi-tenancy, and production hosting paths  
- Local presence and support orientation in **Banjul, The Gambia**

---

## 10. Contact

**Terrafi Pro**  
Banjul, The Gambia  

Email: [support@terrafi.pro](mailto:support@terrafi.pro)  

We would be glad to schedule a demonstration for NAFA’s operations, compliance, and technology stakeholders, and to refine this proposal into a signed pilot or subscription agreement.

---

## Acceptance (optional)

| | NAFA Financial Services | Terrafi Pro |
|--|-------------------------|-------------|
| Name | | |
| Title | | |
| Signature | | |
| Date | | |

**Selected option:** ☐ A Standard &nbsp;&nbsp; ☐ B Unlimited &nbsp;&nbsp; ☐ C Pilot (terms to attach)  

**Preferred billing:** ☐ Monthly &nbsp;&nbsp; ☐ Quarterly  

---

*This document is a commercial proposal and does not constitute a binding contract until both parties execute a formal agreement or accepted order. Pricing and scope are valid for 60 days from the date on the cover.*
