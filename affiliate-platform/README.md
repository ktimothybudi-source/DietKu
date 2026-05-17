# DietKu Affiliate Platform

Fresh rebuild of the DietKu affiliate website with a UI style matching the provided references.

## Included pages

- Dashboard (trials + paid conversions)
- Referrals (trial vs paid per buyer)
- Earnings (commissions on paid conversions only)
- Leaderboard
- Settings (promo code customization)

## Extra feature requested

- Affiliates can customize their own promo code from `Settings`
- Live availability check via `GET /api/affiliates/code-availability`
- Save promo code via `PATCH /api/affiliates/promo-code`

## Local setup

1. Copy `.env.example` to `.env.local`
2. Fill Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
3. Apply main app migration `supabase/migrations/20260517_affiliate_referral_tracking.sql` in Supabase SQL editor (affiliate tables + trial/paid tracking)
4. Install and run:

```bash
npm install
npm run dev
```
