# DietKu Affiliate Platform

Fresh rebuild of the DietKu affiliate website with a UI style matching the provided references.

## Included pages

- Dashboard
- Earnings
- Referrals
- Settings (promo code customization)

## Extra feature requested

- Affiliates can customize their own promo code from `Settings`
- Live availability check via `GET /api/affiliates/code-availability`
- Save promo code via `PATCH /api/affiliates/promo-code`

## Local setup

1. Copy `.env.example` to `.env.local`
2. Fill Supabase credentials
3. Apply `supabase/schema.sql` in Supabase SQL editor
4. Install and run:

```bash
npm install
npm run dev
```
