# Scores against current standards (SCORING_VERSION 11)

Date: 2026-11-23. This note records what changed in v11 and why. It acts on the findings in `recovery-readiness.md`,
`strain-load.md`, `sleep.md` and `stress-healthspan.md`, which reviewed the formulas but changed no code, plus a few items
those reviews did not cover. Each change has a test beside the scorer that states the standard it follows.

## Changed

| Score | Before | Now | Standard |
|---|---|---|---|
| ACWR, monotony, CTL/ATL/TSB (`readiness.ts`) | Ratios, SDs and EWMAs of Effort, a log of TRIMP | The same on linear TRIMP (`trimpFromEffort`). An ordinary 4-workout week: monotony 2.81 → 1.22. A doubled week: ACWR 1.08 → 1.9 | Foster 1998 and Banister's impulse–response model are defined on additive load |
| ACWR form | Coupled 7 / 28-day rolling means | Uncoupled: the last 7 days against the 21 before them. A falling ratio is neutral, not "watch" | Lolli 2019, Windt & Gabbett 2018; weak injury evidence (Impellizzeri 2020) |
| Recovery HRV (`recovery.ts`, `drivers.ts`) | z-score in raw ms | z-score on ln(RMSSD) against an ln baseline (`hrvLnCfg`, floor 0.08). Driver rows show its geometric mean in ms | Plews 2013, Buchheit 2014 |
| Sleep performance (`sleep.ts`) | Unstaged nights scored 0 deep / 0 REM; missing SRI scored 50 | A term without a measurement drops out and the others renormalize | Missing is unknown, not bad |
| Sleep need floor | 8 h for every adult | 7 h adults, 8 h at 13–17, 9 h under 13 | AASM/SRS (Watson 2015), AASM pediatric (Paruthi 2016) |
| Sleep debt | debt = 0.55 × max(0, need + debt − slept) | debt = max(0, 0.8 × debt + need − slept); the Planner repays at most 60 min a night | Van Dongen 2003, Belenky 2003, Kitamura 2016 |
| Pulse Age reference (`healthspan.ts`) | VO2max at the FRIEND 75th percentile; 10,000 steps (8,000 at 60+); 150 + 75 min/week | VO2max at the FRIEND median; 8,000 steps (6,000 at 60+); 150 min/week moderate-or-harder, vigorous as extra benefit | Fitness-age calibration (Nes 2014); Paluch 2022, Ding 2025; WHO 2020, Lee 2022 |
| Pulse Age activity minutes | Display zones 1–3 and 4–5 (50–80 % and ≥ 80 % HRR) | ACSM intensity: ≥ 40 % HRR (moderate or harder) and ≥ 60 % HRR (vigorous), new `mvpa` and `vigorous` trend views | ACSM, Garber 2011 |
| Pulse Age missing inputs | Strength never logged counted as 0 min; missing terms renormalized by 9 / n | Strength counts once a strength workout is logged in 6 months; a missing term adds 0 | A median 40-year-old man: Pulse Age 50.1 → about 40 |
| Fitness category (`fitnessLevel.ts`) | Fair 20th, Good 40th, Excellent 60th, Superior 80th | Fair 40th, Good 60th, Excellent 80th, Superior 95th | Cooper Institute bands |
| SpO2 floor (`healthMonitor.ts`) | 95 % | 90 % | Wrist nightly means are about 95.4 ± 1.5 %; Google: "typically above 90%" |
| HR recovery label (`queries/activity.ts`) | A 12 bpm drop read "Typical" | ≤ 12 bpm reads "Low" | Cole 1999 |
| Banister TRIMP (`strain.ts`) | k = 0.64 for both sexes | k = 0.86 for women (path still off by default) | Morton, Fitz-Clarke & Banister 1990 |
| Default HRmax (`strain.ts`) | 220 − age when none was passed | Tanaka, 208 − 0.7 × age (the pipeline already used it) | Tanaka 2001 |
| Strain naming | "Edwards TRIMP" | Called a zone TRIMP on %HRR in the code; the method is unchanged | Edwards 1993 set zones on % HRmax |

## Not changed, and why

- **FRIEND 2022.** The update (Kaminsky 2022) is 1.5–4.6 mL/kg/min lower than the 2015 table and adds 80–89, but its
  percentile table could not be read: the publisher returns 403 and the paper is not in PubMed Central. The 2015 values
  stay until the table can be transcribed from the paper itself. Against 2022, users would rank somewhat higher.
- **Strain's 0–21 scale and zone TRIMP.** Kept: it is the display scale, and every load ratio now inverts it.
- **Stress σ, journal-impact statistics, Pace of Aging scale.** Statistical design issues in `stress-healthspan.md`,
  not standards; left for their own change.

## Effect on the demo data

Strain is unchanged on every day. Recovery moves by at most 6 points (mean +0.8). Sleep performance rises by 1.5 points
on average, mostly on nights without an SRI read or without stages.
