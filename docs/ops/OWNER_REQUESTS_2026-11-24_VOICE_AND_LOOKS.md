# Owner requests, Nov 24 late: a voice assistant; the shapes and font of the pages (dropped)

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

## 2. Shapes and font — DECIDED: no change

**The owner's words (Nov 24):** "I don't like some of the forms of windows, buttons, form of it,
shape, also the font; maybe something more business casual but elegant", and later "don't forget
about buttons design update".

**What was tried:** three styles to compare on the real pages (Soft, Crisp, Elegant), then a fuller
second pass of Elegant after the owner picked it as the closest and named the buttons, the font, the
boxes and windows, and the spacing. It was a proposal only (pull request #92).

**DECIDED by the owner the same evening:** "never mind, let's leave the design like it was ... I
don't see those changes going a better way, so let's not change buttons, font, design and these
parts." Pull request #92 was closed without merging; nothing reached the live dashboard; the branch
`claude/shape-styles` stays as a record and is not to be merged.

**For every later session:** do not propose changes to buttons, the typeface, shapes or the look
again unless the owner asks. A real fault in how something is shown (a figure that cannot be read,
text cut off) is a bug, not a design change, and is still fixed.

## 3. Order of work agreed that evening

The database part of the New Employee page (done: pull request #90), then the voice box (done:
pull request #91). The three styles were tried and dropped (section 2).
