# The Scalp Ritual — ad set 1

Statics in this folder. Structure is **problem → part line → solution**, then the product.
No faces, no before/after, no growth promises.

| File | Placement |
|---|---|
| `scalp-partline-4x5.jpg` | Feed (primary) |
| `scalp-partline-1x1.jpg` | Feed square |
| `scalp-partline-9x16.jpg` | Stories / Reels |
| `scalp-mechanism-4x5.jpg` | Feed (second concept) |
| `scalp-mechanism-9x16.jpg` | Stories / Reels (second concept) |
| `scalp-sealed-4x5.jpg` | Feed (third concept) |
| `scalp-sealed-9x16.jpg` | Stories / Reels (third concept) |
| `scalp-guarantee-4x5.jpg` | Feed (fourth concept) |
| `scalp-guarantee-9x16.jpg` | Stories / Reels (fourth concept) |

Concepts C and D each use their own scene — three ampoules in a row, and an ampoule at rest
beside the infusion head — so the set does not read as four crops of one photograph as it
scrolls past.

Destination: **https://lennoxbeauty.com/scalp.html**

---

## Concept A — the part line

**Primary text**

> Your part line is one of the first things you notice in the mirror.
>
> The Scalp Ritual is a nine-session copper peptide course you do at home. Nine sealed 5 ml
> ampoules, and a 0.2 mm infusion head that screws straight onto the ampoule — so the serum goes
> in at the surface of the scalp instead of sitting on the hair above it.
>
> No clinic. No numbing. Nothing to charge.
>
> Free US shipping and 30 days to change your mind.

**Headline:** For hair that looks fuller where you part it
**Description:** Nine ampoules + infusion head · $149

## Concept B — the mechanism

**Primary text**

> Almost everything you put on your hair never reaches your scalp — it coats the strand and
> rinses off.
>
> The Scalp Ritual is the other way round. Nine sealed ampoules of copper peptide serum, and a
> 0.2 mm head that feeds it in as you roll along the part line.
>
> 0.2 mm is cosmetic depth: the shallow end of micro-needling, the part that belongs in a
> bathroom rather than a clinic.
>
> Free US shipping, 30 days to change your mind.

**Headline:** Nine ampoules. Nine sessions. $149
**Description:** Copper peptide micro-infusion

*Headline on the image is* **Into the scalp. Not onto the hair.** *— see the note below.*

## Concept C — the sealed ampoule

**Primary text**

> Copper peptides start degrading the moment they meet air.
>
> That is why The Scalp Ritual is nine sealed 5 ml ampoules rather than one big bottle slowly
> going flat on a shelf. You open one per session, screw the 0.2 mm infusion head straight onto
> it, and roll it along your part line.
>
> Nine sessions. Nothing to charge, nothing to decant.
>
> Free US shipping and 30 days to change your mind.

**Headline:** Nine sealed ampoules, opened one at a time
**Description:** Copper peptide · 0.2 mm · $149

## Concept D — risk reversal

The other three all argue about the product. This one removes the reason not to buy, which is the
only lever a brand with no review history actually has.

**Primary text**

> A nine-session copper peptide course for your scalp: nine sealed 5 ml ampoules and a 0.2 mm
> infusion head that screws straight onto the ampoule.
>
> $149, free US shipping, and thirty days to change your mind. If it isn't for you we refund
> every cent. No returns to mail, no forms to fill in.
>
> For hair that looks fuller where you part it.

**Headline:** Thirty days to change your mind
**Description:** Nine ampoules + infusion head · Free US shipping

---

## Before you write another variant

Every line, in the creative and in the ad text, gets the same test as the page:

**Allowed** — looks fuller · looks thicker · the appearance of · where you part it · conditions ·
revitalises · supports scalp health.

**Forbidden** — regrow · growth · regrowth · thinning · hair loss · shedding · density ·
follicle · "results" · any before/after image · any face.

"Looks fuller" is a claim about how hair looks and is ours to make. "Fuller hair" is a claim
about how much hair there is, which is a drug claim. That distinction is the whole reason this
product cleared the bar when the laser caps didn't — see `Standing Decisions` in the vault.

Meta's personal-attributes policy also bites here: copy must not imply we know something about
the viewer's own hair. "Your part line is one of the first things you notice" is an observation
about mirrors. "Worried about your thinning hair?" is an attribute claim and gets rejected.

## How these were made

Scenes are Higgsfield (`gpt_image_2_5`, referenced off the real Kit 2 photo, ~1 credit a batch).
**All type is composited locally** in Cormorant Garamond and Inter — the brand's own fonts —
rather than generated, because generated type is where the gibberish and the off-brand
letterforms come from. Build script: `scratchpad/make_ads.py`.

---

## Two defects found and fixed — 2026-09-12

**1. The generated ampoule label read `SML/0.17FL.OZ`.** The real ampoule says **5ML**. Five of the
nine statics carried the typo: both guarantee files, both mechanism files and `partline-4x5`. The
other four rendered `5ML` correctly — same model, same prompt, so this is a lottery, not a setting.

A misprinted label is the single loudest *made by a machine* tell on a $149 product ad, and it is
invisible until someone zooms. **Check the product label on every generated scene before it ships.**

Fixed by repainting the wrong glyph in Inter, colour-sampled from the neighbouring letters, blurred
to match and rotated to the label's own baseline angle — the same principle as the rest of the type
on these ads: if a model can't be trusted to set type, set it yourself. Script: `scratchpad/fix_label.py`.

**2. Concept B's headline counted ampoules over a photograph of one ampoule.** It read
*"Nine ampoules. Nine sessions."* above a single bottle. The picture called the headline a liar, and
the count belongs to Concept C anyway, which actually shows a row of them.

Concept B is the **mechanism** ad, so its headline is now the mechanism:

> **Into the scalp. Not onto the hair.**
> Copper peptide serum at 0.2 mm — cosmetic depth, no clinic and nothing to charge.

**The rule this leaves behind: read the headline against its own photograph.** Every claim of
quantity in a composited headline has to survive being looked at next to the thing it counts.

---

## Ad-to-page match — 2026-09-19

The page now states cadence, a per-session price and a clinic comparison. Two things follow.

**Destination.** The line above still says `lennoxbeauty.com/scalp.html`. Live destinations were
audited to **`https://lennoxbeauty.com/scalp-ritual`** on 09-15. Use the slug; `scalp.html` is a
redirect stub and a hop that costs nothing to remove.

**Concept C's "salon microneedling" framing has to go.** It promises the clinic, and the page
spends a section and an FAQ answer explaining that this is *not* the clinic — 0.2 mm against
0.5 mm and up, no PRP, no drug. An ad that sells the clinic to a page that disclaims it is the
worst kind of message mismatch: it buys the click and then argues with the visitor.

Rewrite it as the shallow end rather than the deep one:

> **Headline:** The 0.2 mm end, done at home
> **Primary text:** A clinic works at 0.5 mm and up, with a numbing cream and an appointment.
> The Scalp Ritual is the shallow, cosmetic end of the same idea: a 0.2 mm head that screws onto
> a sealed ampoule of copper peptide serum, twice a week, in your own bathroom.
> Nine sessions. Free US shipping, 30 days to change your mind.

**Still forbidden, and now for a second reason:** *"Fuller-looking in 30 days, or refunded"* was
swapped off LNX-SC-05 on 09-15. It stays off. The page prints a schedule — two a week, nine
ampoules, session nine around day 29 — and a schedule is not a promise about what will be there
at the end of it. An ad that converts the schedule into a timed result re-opens exactly the claim
the page is built to avoid.

**And the 5.0 / 133 never goes in an ad.** On the page that number carries a label saying whose
buyers it belongs to. An ad has nowhere to put that label.
