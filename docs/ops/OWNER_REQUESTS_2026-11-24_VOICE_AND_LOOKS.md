# Owner requests, Nov 24 late: a voice assistant, and the shapes and font of the pages

Status: CURRENT. What the owner asked for, what was agreed, and what is still open. The build
status of each piece is in `BUILD_TRACKER_2_WEEKS.md`.

## 1. Voice assistant ("something like a Siri of my app")

**The owner's words (Nov 24):** a voice assistant, on the owner account only for now, "that I can
talk with and that can tell me everything if I forget something, or I can ask any questions". Later
the same evening: "I love all ideas, let's build them as well", and to combine it with the smart
search.

**Agreed, in two stages**

Stage 1, no outside service, owner account only, behind its own switch (DECIDED, to build):

1. One box for typing and talking, joined with the existing search: it finds records and pages and
   answers questions.
2. "Brief me": the day read out (new orders, customers waiting, low stock, late parcels, what is
   left before launch).
3. Every answer also on screen, with the exact number and a button to the page it came from.
4. Follow-up questions ("and last week?").
5. "Remind me to…": it shows the task it is about to create and the owner confirms with one tap.
   The only part that writes a record.
6. Quiet mode: the answer is shown, not spoken; customer names are not read aloud unless asked.

Stage 2, "ask anything" in the owner's own words (OWNER DECISION REQUIRED, after launch): needs a
paid AI service (a few dollars a month at this size), a small helper program at the database
provider so the service's key is never in the page, and the owner's agreement that business data is
sent to that service to be answered.

**Limits told to the owner:** Stage 1 understands a fixed set of kinds of question, not any
sentence; the voice is turned into text by the device's own dictation (the browser's), not by the
dashboard; it reads and tells, and apart from the confirmed reminder it changes nothing.

## 2. Shapes and font ("business casual but elegant")

**The owner's words (Nov 24):** "I don't like some of the forms of windows, buttons, form of it,
shape, also the font; maybe something more business casual but elegant" (Claude's reading of the
last words; told to the owner and not contradicted), and later: "don't forget about buttons design
update, maybe a shape a little more [distinct] but still stable, change the font, improve some
parts".

**Agreed:** three styles the owner can switch between on the real pages and compare, the way the
colours were chosen:

- Soft: rounder buttons and windows, more air.
- Crisp: small corners, thin lines, tighter.
- Elegant: a classic font for headings with a clean one for text, calm buttons.

OWNER DECISION REQUIRED after the three exist: which one becomes everyone's look. Asked of the
owner, not blocking: a screenshot of the page or window liked least, with what bothers circled.

## 3. Order of work agreed that evening

The database part of the New Employee page (done: pull request #90), then the voice box, then the
three styles.
