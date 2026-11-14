-- READ-ONLY QUERY I: which day cutoff does the nightly report use? (2026-11-14)
-- READ-ONLY: one SELECT. It changes nothing. Safe to run any time, as often as
-- wanted (Supabase -> SQL Editor -> New query -> paste -> Run -> Export CSV).
-- Why: the owner decided on Nov 14 that the reporting day ends at midnight
-- Central time (America/Chicago, daylight saving handled automatically). The
-- nightly job that fills daily_reports is not in this repository, so nobody can
-- tell from the code which cutoff it uses today. This query finds out from the
-- data: for each saved report in the last 45 days it counts that day's orders
-- twice, once by the Central calendar day and once by the UTC calendar day, and
-- says which count the saved report agrees with.
-- Each row: ITEM, REPORTED (orders on the saved report), CENTRAL_DAY, UTC_DAY,
-- VERDICT and ACTION in plain words. Row I00 is the conclusion. A day whose two
-- counts are equal cannot tell the cutoffs apart (SAME EITHER WAY) - that is
-- normal for most days. MATCHES NEITHER usually means the nightly job counts
-- orders by a different rule (for example leaving out cancelled orders), not
-- that anything is broken. Only counts are printed: no customer data, no order
-- contents, no amounts.
-- Local test: docs/ops/sql/local-test/report_day_cutoff_test.sh
with r as (
  select report_date::date as d, orders_count::bigint as reported
    from daily_reports
   where report_date::date >= current_date - 45
), o as (
  select placed_at
    from orders
   where deleted_at is null
     and placed_at >= (current_date - 47)::timestamptz
), per as (
  select r.d, r.reported,
         (select count(*) from o where (o.placed_at at time zone 'America/Chicago')::date = r.d) as central_n,
         (select count(*) from o where (o.placed_at at time zone 'UTC')::date = r.d) as utc_n
    from r
), v as (
  select d, reported, central_n, utc_n,
         case when central_n = utc_n then 'SAME EITHER WAY'
              when reported = central_n then 'MATCHES CENTRAL'
              when reported = utc_n then 'MATCHES UTC'
              else 'MATCHES NEITHER' end as verdict
    from per
), s as (
  select count(*) as days,
         count(*) filter (where verdict = 'MATCHES CENTRAL') as central_days,
         count(*) filter (where verdict = 'MATCHES UTC') as utc_days,
         count(*) filter (where verdict = 'MATCHES NEITHER') as neither_days
    from v
)
select 'I00' as item, null::bigint as reported, s.central_days as central_day, s.utc_days as utc_day,
       case when s.days = 0 then 'NO DATA'
            when s.central_days > 0 and s.utc_days = 0 then 'PASS'
            when s.utc_days > 0 and s.central_days = 0 then 'ACTION'
            when s.central_days > 0 and s.utc_days > 0 then 'UNCLEAR'
            else 'NOT ENOUGH DATA' end as verdict,
       case when s.days = 0 then 'No saved reports in the last 45 days. Run again once the nightly report has run.'
            when s.central_days > 0 and s.utc_days = 0 then 'The nightly report already follows the Central-time day on ' || s.central_days || ' telling day(s). Nothing to change.'
            when s.utc_days > 0 and s.central_days = 0 then 'The nightly report follows the UTC day on ' || s.utc_days || ' telling day(s). It needs a change to follow the owner''s Central-time decision. Show this result before changing anything.'
            when s.central_days > 0 and s.utc_days > 0 then 'Mixed: ' || s.central_days || ' day(s) match Central and ' || s.utc_days || ' match UTC. The cutoff may have changed during the window. Show this result.'
            else 'No day in the window can tell the two cutoffs apart (' || s.neither_days || ' day(s) match neither count). Run again after a day with an evening order, or show this result.' end as action
  from s
union all
select 'I-' || to_char(v.d, 'YYYY-MM-DD'), v.reported, v.central_n, v.utc_n, v.verdict,
       case v.verdict when 'SAME EITHER WAY' then 'Cannot tell the cutoffs apart on this day (normal).'
                      when 'MATCHES CENTRAL' then 'The saved report agrees with the Central-time day.'
                      when 'MATCHES UTC' then 'The saved report agrees with the UTC day.'
                      else 'The saved report agrees with neither count; the nightly job may count orders by a different rule.' end
  from v
 order by 1;
