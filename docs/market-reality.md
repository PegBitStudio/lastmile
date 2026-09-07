# Does Lastmile matter outside our heads?

A country-by-country check of how last-mile delivery actually works, run to test one claim in the
spec: that the *narrative* of a delivery exception is missing everywhere, and that region packs
make the product global.

Researched September 2026. Sources at the bottom. Several figures come from vendor and industry
blogs rather than audited studies — treat them as direction, not precision.

---

## The short answer

The gap we describe is real, but **it is not evenly global**. It is large in countries where the
address is a description rather than a number, and where the parcel is paid for in cash. It is
small to non-existent in the rich, dense, locker-heavy markets — which is exactly where hackathon
judges live.

That is a pitch problem, not a product problem. We should stop saying "it works in more than one
country" and start saying *which* countries, and why those.

---

## 1. The four things that decide whether we matter

Every country below comes down to the same four questions.

| Question | Why it decides our value |
|---|---|
| **Does a human meet the parcel?** | Locker and pickup-point markets have no doorstep conversation. No conversation, no narrative. |
| **Is the address a number or a description?** | "Third gate after the mosque" is where our keyterm biasing earns its keep. A UK postcode does not need us. |
| **Is money changing hands at the door?** | Cash on delivery turns every exception into a money dispute. That is where a narrative has cash value. |
| **Who employs the driver?** | A gig contractor installs nothing. A fleet mandates software. That decides who we sell to. |

---

## 2. Country by country

### Europe

**United Kingdom.** First-attempt success was 92.9% in Q2 2025 — so roughly one parcel in
fourteen goes wrong, a bigger exception pool than people assume. A failed delivery costs about
£11.6 per parcel. Addresses are clean, but the *narrative* problem is genuinely present: "left in
the safe place", "given to a neighbour", "buzzer not working" are the disputed cases, and the
driver taps a code and moves on. **Verdict: our gap exists, it is narrow but real, and the
disputes are expensive.**

**Poland, and Europe generally.** Half of all parcels in Poland go out-of-home, mostly to InPost
lockers — over 20,000 of them. Across Europe, 46% of regular online shoppers now prefer
out-of-home delivery. **Verdict: in a locker market there is no door, no recipient and no story.
We are irrelevant to half of Poland's volume.** This is the strongest argument against the global
claim, and we should say it before a judge does.

**Legal note for all of the EU.** In December 2025 the CJEU ruled (Case C-422/24) that people
recorded by a body camera must be told at the moment of recording, under Article 13 GDPR, not
afterwards. Any voice recording of an identifiable person is personal data needing a lawful basis
and a retention period. We record the driver, not the concierge — but the driver *names* the
concierge. That is still personal data about a third party who was never told.

### North America

**United States.** First-attempt success 97.2%. The exception pool is thin. Amazon DSP and UPS
drivers already carry a device that forces a structured reason code plus a photo, and photo proof
of delivery is claimed to cut disputes by 60–80%. What is left is theft, not narrative: 29.7% of
US households reported a stolen package in 2025, around $7.9bn in refunds and replacements. A
driver's spoken account does not settle a porch theft.

There is also a legal problem specific to the US. Illinois BIPA sets statutory damages of $1,000
per negligent and $5,000 per reckless violation, per recording, and courts are certifying
voiceprint classes — 1.2 million Illinois residents in *Gunderson v. Amazon*, November 2025. A
recording becomes a biometric identifier the moment you use it to recognise or analyse a speaker.
**Verdict: weakest market for us, and the most legally expensive. Do not lead with the US.**

**Mexico.** App couriers became employees under a Federal Labor Law amendment published in
December 2024. That helps us: employed drivers mean an employer who can mandate a tool.

### Latin America

**Brazil.** The interesting case. Favelas are treated as "shadow zones" — confusing postal codes,
alleys that mapping apps cannot resolve, and carriers that refuse the address outright. Residents
report being told nobody was home when nobody called. That last point *is* our product: a
contested account with no record on either side. Security risk also drives repeat attempts and
alternative routing. **Verdict: strong fit, and an unusually sympathetic story.**

### Africa

**Nigeria.** Large numbers of locations have no standard address, estate numbering is
inconsistent, and Lagos traffic wrecks schedules. Gate handover is normal enough that local
carrier software sells "photo at gate" as a feature. COD is over 70% of orders. **Verdict:
strongest single market for the product as specified. Our Lagos pack is not a diversity gesture,
it is the core market.**

**Kenya and Egypt.** In Kenya many residential addresses are not geocodable — unnamed streets,
missing building numbers, navigation by landmark. Egypt has no comprehensive standard address
system; Cairo and Alexandria mix landmarks, informal area names and duplicated building numbers.
Around 20% of shipments fail on the first attempt in these markets.

**One finding that matters more than any other in this report:** across MENA and Africa, drivers
and customers already coordinate by **WhatsApp voice note** — live location, spoken directions,
photos of landmarks. Voice is not a behaviour we have to teach. It is already the default.

### Asia

**India.** Around 45% of return-to-origin failures in 2025–26 were caused by incomplete or wrong
addresses. RTO on COD orders runs roughly 10–25% depending on category. COD is 60–70% of orders.
The government is piloting DIGIPIN, a short digital address code, with Flipkart, Amazon, Meesho,
Delhivery and Swiggy. Delhivery already sells AI address correction. **Verdict: huge fit — and
note that an incumbent is already moving on the *address* half of the problem, but not on the
narrative half.**

**Pakistan.** COD is 65–70% of e-commerce. Lahore's phase-and-block addressing plus landmark
directions is exactly the case keyterm biasing is built for. **Verdict: strong fit, and we have a
native speaker on the team.**

**Gulf (UAE, Saudi Arabia).** Delivery is done almost entirely by migrant workers — 2025 research
interviewed riders from Bangladesh, Cameroon, India, Kenya, Nepal and Pakistan across the two
countries. Migrants are 80–90% of the labour market in the UAE. **Verdict: this is where our
"accept accents, dialects and code-switching, never ask the driver to repeat in standard English"
rule stops being a nice line and becomes the whole product.** It is also a market with documented
labour-rights problems, so a tool that records drivers has to be visibly on the driver's side.

**China and Japan.** China has 400,000+ smart lockers, and parcels route through Cainiao stations
and pickup points rather than to a door. Japan runs on konbini pickup and locker networks tied to
Yamato and Sagawa. **Verdict: the doorstep conversation we are built around largely does not
happen. Write these markets off.**

### Oceania

**Australia.** Behaves like the UK — clean addresses, high first-attempt rates, a growing locker
network. Same narrow-but-real gap, much smaller volume.

---

## 3. Who else is doing voice

DispatchTrack launched "Driver AI" in May 2025 and called it the industry's first voice assistant
for delivery drivers. It plays a 30-second audio briefing *to* the driver before each stop —
access notes, parking, building layout. It is **voice out only**. There is no speech capture, no
exception reporting by voice, and no structured record produced from what the driver says.

Other driver apps offer voice-to-text for messaging a dispatcher. That produces a chat message,
not a record.

**So the white space is genuine.** Nobody in the parcel industry is capturing the driver's spoken
account and turning it into a structured, field-level, citable record.

**But the real incumbent should be named honestly: it is WhatsApp.** Free, already installed, and
drivers already send voice notes on it. What it cannot do is produce a schema-shaped record with a
missing-field list, a confidence flag, and a per-field audio citation. That difference — not
"voice" — is our entire product. The pitch should say this out loud.

---

## 4. What this changes

**Keep.** The three packs are the right three: London is the credibility pack, Lagos and Lahore
are the market. The safety gate travels everywhere. The stated / observed / proof split is what
makes this survive a lawyer.

**Change five things.**

1. **Stop claiming "global". Claim the two-thirds.** The honest line is: *this is built for the
   markets where the address is a description and the parcel is paid in cash.* Then name them —
   Nigeria, Kenya, Egypt, India, Pakistan, Indonesia, Brazil. That is a larger population than the
   locker world, and it is the half nobody builds for.

2. **Make cash the second demo beat.** COD is 60–70%+ across our target markets. A payment
   shortfall is a money dispute between a driver and their employer, and it is the exception where
   a narrative has direct cash value. The spec already has `payment_shortfall`. Put it on camera.

3. **Add a "where this does not apply" slide.** Lockers, China, Japan, US density. Judges reward a
   team that knows its own boundary; they punish one that claims everything.

4. **Say the recording rule out loud, with the law behind it.** We record the driver only. Third
   parties are *named*, never recorded. We keep the cited turns, not the route. Cite the CJEU
   December 2025 ruling and Illinois BIPA. That turns our biggest risk into a slide that shows
   homework.

5. **Sell to the fleet, not the driver.** Gig contractors install nothing and are paid per parcel,
   so anything that adds seconds is resisted. Aim the whole pitch at the operator who mandates the
   tool and pays the failed-delivery cost — £11.6 in the UK, $17.2 in the US, twice the shipping
   cost on an African RTO.

**The one number worth measuring before the video.** Time a driver typing the narrative into a
notes field, versus saying it. If speaking is not clearly faster, our gig-market story collapses.
It is a five-minute test with a phone and a stopwatch.

---

---

## 5. Where audio still helps in the markets that looked dead

Lockers, Japan and the US kill the *doorstep* story. They do not kill voice. In each one the
exception just moves somewhere else, and it is still nobody's job to type it.

Four plays, strongest first.

### Play 1 — turn the microphone around: capture access knowledge

DispatchTrack's Driver AI reads access notes *to* the driver before each stop: which gate, where to
park, how the building works. Someone had to know that. Nobody in the industry captures it — it
lives in one driver's head and leaves when they quit.

We are the input side of a feature an incumbent already sells the output side of. A driver who has
just worked out that the loading bay is on the north side and closed after 4pm says it once, in
twenty seconds, while parked. The next driver hears it.

This works in **every** market on earth, lockers and US suburbs included, because it is about the
place, not the recipient. It needs no new schema — `location.place`, `location.entrance` and
`location.notes` already hold it. It changes the outcome enum, not the product.

### Play 2 — point it at the asset, not the recipient (locker Europe)

A locker market has no recipient, but it has 20,000 machines that break, fill up and get vandalised.
Parcels are already returned to sender because the locker was full, and customers report the
availability display disagreeing with what the courier actually found. That gap is a driver
standing in front of a machine with knowledge the network does not have.

"Bank at the Biedronka, three compartments jammed shut, ice in the hinges, moved eight parcels to
the Żabka bank 400m north." That is an estate-condition report, it is worth money to a network
operator, and today it is a phone call that never gets made.

Same product. The recipient fields go quiet and the location fields do the work.

### Play 3 — Japan: the exception is "why nobody was in", and time is now rationed

Japan's redelivery rate was 8.4% (9.3% in cities). The ministry target of 7.5% for FY2025 looks
like it will be missed. And since April 2024 driver hours are legally capped, so every second of
paperwork is a second of regulated, scarce capacity.

The narrative that matters is not who took the parcel. It is what the driver learned at the door —
the intercom is broken, the household is out until eight, there is a locker two streets away that
this customer would accept. That feeds the redelivery decision, which is the exact number the
government is measuring. Speaking it is faster than typing it, and in Japan faster is now
regulatory, not just nice.

### Play 4 — USA: change the parcel, not the country

US parcel is a bad market for us: 97.2% first-attempt success and a device that already forces a
reason code and a photo. But that is only one kind of last mile.

Furniture and appliance final-mile runs damage rates of roughly **5–10%** — two to three times the
whole US parcel failure rate, on goods worth hundreds of dollars, delivered by two-person crews
whose hands are full and who are the only witnesses. Freight OS&D (over, short, damaged) reporting
is the same shape. So is grocery cold chain and pharmacy.

The exception pool is bigger, each event is worth far more, and the driver physically cannot type.

**The US caveat stands:** Illinois BIPA does not care which vertical you are in. Driver-only
recording, clear notice and a stated retention period are not optional there.

### What this means for the build

Nothing. None of these need new code. Each is a different **outcome enum and a different follow-up
table** — which is the same "data, not code" claim we already make about region packs.

That is worth saying out loud, because it upgrades the claim. The packs are not just a way to
change country. They are a way to change *what kind of exception you are reporting*. Region is one
axis; event type is the other, and it is the bigger one.

For the hackathon this is a slide, not a build. Ship the three region packs. Say in one sentence
that the same table swap points the product at locker networks, redelivery decisions and freight
damage — and that we know which markets we are not for.

## Sources

- [Parcel Perform — first-attempt success rates, Q1 2025](https://www.parcelperform.com/insights/top-routes-with-the-highest-first-time-delivery-success-rates-in-q1-2025)
- [SmartRoutes — delivery success rate statistics](https://smartroutes.io/blogs/delivery-success-rates-key-stats-for-retail-and-ecommerce/)
- [Selligate — top cash-on-delivery countries, 2026](https://selligate.com/top-10-e-commerce-cash-on-delivery-cod-countries-in-2026/)
- [eGrow — the state of COD e-commerce, 2026](https://www.egrow.com/en/blog/the-state-of-cod-e-commerce-in-2026-markets-trends-and-opportunities)
- [iCargos — Pakistan courier and logistics market report, 2026](https://icargos.com/post/pakistan-courier-logistics-market-report-2026)
- [iCargos — last-mile challenges in Lagos, Nairobi, Casablanca](https://icargos.com/post/last-mile-delivery-challenges-africa)
- [All Business Africa — the dispatch rider economy and the address problem](https://allbusiness.africa/insights/african-last-mile-delivery-ecommerce)
- [Free Press Journal — DIGIPIN and Indian addressing](https://www.freepressjournal.in/lifestyle/forget-pin-codes-how-digipin-could-change-the-way-india-finds-addresses)
- [Base — Indian courier partners ranked by RTO rate](https://base.com/en-IN/blog/best-courier-partner-for-d2c-brands-in-india/)
- [Forum Macao — logistics in Brazil's favelas](https://www.forumchinaplp.org.mo/en/economic_trade/view/9063)
- [ABC News — a last-mile solution born in a Brazilian favela](https://www.abc.net.au/news/2021-09-12/last-mile-solution-for-brazilian-favela-born-from-covid-pandemic/100445386)
- [nshift — EU parcel locker growth, 2025](https://nshift.com/blog/eu-parcel-locker-growth-in-2025-what-it-means-for-retailers)
- [DHL — out-of-home delivery trends, 2025](https://www.dhl.com/global-en/microsites/ec/ecommerce-insights/insights/e-commerce-logistics/out-of-home-trends.html)
- [DispatchTrack — Driver AI launch](https://www.dispatchtrack.com/blog/driver-ai-2/)
- [PPC Land — CJEU body camera ruling, Article 13 GDPR](https://ppc.land/body-cameras-require-immediate-disclosure-under-gdpr-eu-court-rules/)
- [EUR-Lex — Case C-422/24](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:62024CJ0422)
- [American Bar Association — voiceprints, AI and BIPA](https://www.americanbar.org/groups/litigation/resources/newsletters/class-actions-derivative-suits/voiceprints-ai-bipa-new-trends-biometric-privacy-litigation/)
- [Equidem — platform delivery riders in Saudi Arabia and the UAE](https://equidem.org/reports/free-to-be-exploited-the-abuse-of-platform-based-food-delivery-riders-in-saudi-arabia-and-the-uae/)
- [Omnisend porch piracy figures, via Stacker](https://www.northcountrynow.com/premium/stacker/stories/porch-piracy-delivery-fraud-and-the-rising-cost-of-lost-packages,370870)
- [Nippon.com — parcel redelivery rate in Japan](https://www.nippon.com/en/japan-data/h02461/)
- [Statista — Japan door-to-door parcel redelivery rate, 2018-2024](https://statista.com/statistics/1220819/japan-door-to-door-parcel-redelivery-rate)
- [InPost help — locker collection and courier visits](https://inpost.co.uk/help)
- [uShip — reducing damage claims on furniture deliveries](https://www.uship.com/blog/business-shipping/reducing-damage-claims-furniture-deliveries/)
- [NXTPoint Logistics — exception management in the final mile](https://nxtpointlogistics.com/blog/exception-management-in-the-final-mile/)
