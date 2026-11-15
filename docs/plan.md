# Our Date Planner and Memories: Features and Architecture Plan

Prepared for Ayaan, 14 November 2026. Status: application routes and server actions are implemented. Revision 5: memory uploads support batches and 400 KB thumbnails; the closet and Google Maps data features are removed.

## 1. What we are building

A private website for two people. They plan dates together, keep photo memories in albums, and get notified when something changes. Only the two of them can ever see the data.

The UI design lives in the canvas "Our Date Planner" (also saved as a PDF). This document records every feature and decision we reached, so the build can start from one place.

## 2. Decisions we reached

| Topic | Decision |
| --- | --- |
| Users | Exactly two accounts, created manually. Public sign-up is off. |
| Login system | Supabase Auth: email and password, with authenticator-app two-factor. |
| Database | Supabase Postgres (cloud project, no local Supabase) with Row Level Security on every table. |
| Frontend and backend | Latest stable Next.js (App Router) with TypeScript. The backend is Next.js route handlers and server actions running on Node. No separate server. |
| Becoming a couple | Inside the app: each person makes a profile, one searches the other's username, picks the profile, and sends a pair request. The other accepts. |
| Photos | The browser shrinks each photo to 400 KB or less before upload. Originals stay on the phones. |
| Notifications | In-app list plus an email sent with Resend, with a switch to turn email off. |
| Places (changed) | **No Google Maps API, no live place search, no map preview.** Places are typed in by hand: a name, an optional address or note, and an optional pasted Google Maps link. The "Open in Google Maps" button opens that link, or a plain Google Maps search link built from the name. The partner sees the place name, address and button before confirming. |
| Looks | Each person chooses their own theme: mode, font, color and font color. |
| Hosting and GitHub | Later. Build and test on localhost first, using the Supabase cloud project. |
| Secrets | Kept in the `.env` file, which is never committed to git. |

## 3. Features

### 3.1 Accounts and profiles

- Two accounts are created by hand in the Supabase dashboard, with emails confirmed and strong passwords.
- First sign-in leads to **Make your profile**: profile picture, name, a unique username (the ID), and a one-line bio. Pairing is optional during onboarding; users can skip it and add their partner later from Home, Us, or Settings.
- **Edit profile** later: picture, name, username, bio, optional birthday.
- Changing the username must not break the pairing.

### 3.2 Pairing (becoming a couple)

1. The user types their partner's username.
2. Matching profiles appear with picture, name, username and bio.
3. The user picks the right profile and sends a pair request.
4. The partner sees "[NAME] wants to pair with you" and accepts or declines.
5. Accepting creates one shared couple. Every date, album and photo belongs to that couple.

Safeguards: search matches the exact username only, results show no email or private details, requests and searches are rate-limited, one accepted partner per person, and unpairing cuts access at once.

### 3.3 Date planner flow

Steps, each a cute card screen:

1. **Mood and activity:** Cozy, Romantic, Adventurous, Silly, then walk, cafe, movie, picnic or boat ride.
2. **Where to:** two tabs.
   - *Our places:* saved places visited often, with visit counts and an "Open in Google Maps" button.
   - *New place:* the user types a name (required), an optional address or note, and optionally pastes a Google Maps link. A switch saves it to Our places. There is no search, no suggestions and no map preview.
3. **Craving:** food chips (biryani, fuchka, pasta, dessert, coffee). This is its own step after the place, the same for saved and new places.
4. **Day and time:** day cards and named time slots such as Golden hour, Sunset, Evening, Late night.
5. **Outfit and color:** quick pick of style and color for each of them.

### 3.4 Date request and confirmation

- Sending the plan creates a **pending** date request, with a progress bar (Sent, then Confirmed).
- The sender can edit or cancel while it is pending.
- The partner sees "[NAME] planned a date" with the day, time, place (name, address and the Open in Google Maps button) and food, and chooses **Confirm date** or **Suggest a change**.
- Only the person who did not create the request can confirm it. This rule is enforced on the server and in the database.
- After confirmation, the celebration screen appears (confetti, ticket summary, add to calendar).

### 3.5 Memories

- **Memory albums:** each album is a big cover picture with a title, photo count and date.
- **Inside an album:** back button, hero photo with caption, grid of all photos, and an Add photos button.
- **Add photos:** pick an album or create one, see each photo's size before and after shrinking, and save.
- Originals stay on the phone. The site keeps only the small copies as reminders.
- Add a "download all memories" button as a backup.

### 3.6 Notifications and email

- **In-app list:** new date request, date confirmed, new photos added, paired. Unread items have a dot.
- **Email:** the same events can also email the partner (including to Gmail), sent through Resend. The email is short: day, time, place and an "Open our corner" button. No photos or private text.
- A switch in Settings turns email on or off.
### 3.7 Us page

Both profile pictures joined by a heart, names, "Together since" date, days together counter, dates planned, photos saved, and Edit my profile.

### 3.8 Settings and appearance

- **Settings:** profile card with Edit, Appearance, email switch, change password, two-factor login, sign out of all devices, who you are paired with, and Sign out.
- **Appearance (per person):** mode (Light, Dark or Pink), font style (Soft, Classic, Handwritten, Simple), accent color, and font color.
- Block or warn about combinations that make text hard to read.

## 4. Screen map (21 current screens)

1. Login
2. Make your profile
3. Find your partner
4. Pair request received
5. Mood and activity
6. Our places (the small map card becomes a text-only summary)
7. New place (now a simple form: name, address or note, optional Maps link, save switch)
8. Day and time
9. Outfit and colors
10. Date request pending
11. Partner confirms date
12. Date confirmed
13. Memory albums
14. Inside an album
15. Add photos
16. Notifications
17. Email alert
18. Us
19. Settings
20. Appearance
21. Edit profile

The original design PDF includes screens for the removed closet feature. It is not part of the current application.

## 5. Architecture

### 5.1 Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Login | Supabase Auth | Proven system, built-in two-factor, ties to database rules. |
| Database | Supabase Postgres (cloud) | You already know SQL and Postgres. |
| File storage | Supabase Storage, one private bucket named `photos` | Signed links that expire. Albums and avatars use different folders. |
| App | Next.js (latest stable, App Router) and TypeScript | One codebase for pages and backend. |
| Backend code | Route handlers and server actions on the Node runtime | Emails and rule checks. No separate server and no Edge Functions needed. |
| Email | Resend, sending from a verified sender | Notification emails to any inbox, Gmail included. |
| Hosting | Later (Vercel or Netlify over HTTPS) | Develop on localhost first. |

There is no maps service. Google Maps is only a link the user pastes or a plain search link, so there is no maps key and no maps cost.

Things to check before building (they change over time): the free-tier limits of Supabase and Resend, whether Resend lets you send to other people's inboxes without your own verified domain, and whether passkeys are supported in Supabase Auth.

### 5.2 Data model (in words)

- **profiles:** user ID, name, unique username, bio, birthday, photo path, theme settings (mode, font, color, font color), email-alerts flag.
- **pair\_requests:** sender, receiver, status (pending, accepted, declined), created time.
- **couples:** the two member user IDs, "together since" date.
- **places:** couple, created-by, name, optional address or note, optional Google Maps link, visit count, saved flag.
- **dates:** couple, name, created-by, mood, activity, place, food, day, time, outfit style and color for each person, status (pending, confirmed, changed, cancelled).
- **albums:** couple, title, cover photo, date.
- **photos:** album, storage path (random name), caption, uploaded-by, size, time.
- **notifications:** recipient, event type, linked item, read flag, time.

### 5.3 How the main flows work

- **Date request:** inserting a pending date also writes a notification row for the partner. The server then sends the email through Resend. If the email fails, the date and the notification still stand.
- **Confirm:** the server and a database rule check that the person confirming is the other member of the couple, then flip the status and notify the sender.
- **Photo upload:** the browser resizes (about 1600 px on the long side) and re-compresses until the file is 400 KB or less, then uploads only that copy and a 400 px thumbnail. The server checks type and size again. Server Actions accept up to seven photos per request; the deployment host must allow request bodies of at least 4 MB.
- **Add a place:** the user types a name and optionally an address and a pasted Maps link. The server checks the link is https and from a Google Maps host, then saves it. The Open in Google Maps button uses the saved link, or builds a Google Maps search link from the name and address.

The application adds `supabase/migrations/008_app_notifications_and_cancellation.sql` for pending-date cancellation and photo-added notifications, `009_date_change_suggestions.sql` for partner change requests and resubmitting a revised date, `010_confirmed_date_counts.sql` to update saved-place counts when a date is confirmed, and `011_pending_date_edit_notifications.sql` to notify the partner when a pending request is edited. Apply these migrations in order in the Supabase SQL Editor after migrations 001–007 before using those flows. Apply `012_remove_closet.sql` after 011 to remove the retired closet schema, then `013_photo_400kb_and_thumbnails.sql` to add thumbnails and enforce the new upload limit.

## 6. Security plan

### 6.1 Authentication

- Sign-ups are turned **off**. Only the two accounts you create manually exist.
- Authenticator-app two-factor for both accounts. Avoid SMS codes.
- Email verification on, strong unique passwords, rate-limited login attempts.
- Short sessions with refresh, and "sign out of all devices".
- Password reset only works for the two existing emails. Make sure both inboxes are safe. As admin, you can reset a password from the dashboard.
- Test that a new sign-up is refused, both on the site and by calling the login system directly.

### 6.2 Authorization

- Row Level Security on every table: a row is visible only to members of the couple that owns it.
- Block by default, then allow only what is needed. A forgotten table is the classic leak.
- The browser never says who the couple is. The server looks it up from the logged-in account.
- Pairing and date confirmation are enforced on the server and in the database.

### 6.3 Photos and files

- Private storage bucket and short-lived signed links.
- Storage rules so only couple members can read or write their folder.
- Check file type and the 400 KB limit on the server as well as in the browser.
- Remove hidden photo data such as GPS location. Verify the browser resize really does this.
- Random file names, never descriptive ones.

### 6.4 Secrets, web and email

- Only the public Supabase URL and publishable key go to the browser. The Supabase secret (service role) key and the Resend key live on the server only, in the `.env` file and later in the host's environment settings, never in the code.
- Make sure `.env` is listed in `.gitignore` before the first commit.
- A usage limit on Resend, and one small email function so the provider can be swapped.
- HTTPS only, security headers (Content Security Policy, no embedding in other sites).
- Never insert user text into the page as raw HTML, including captions and names.
- A pasted Maps link is opened by the partner, so accept only https links from Google Maps hosts and open them with no-referrer and no-opener settings.
- Keep dependencies updated and run an audit before each release.
- Send emails from a verified sender and keep them free of photos and private text.

### 6.5 Backups and recovery

- Check what the Supabase plan includes for automatic backups.
- A "download all memories" button.
- Originals stay on the phones, and turning on phone photo backup protects them.

### 6.6 Before launch

Log in with a third test account and confirm it cannot read the couple's dates, albums or photos by guessing IDs or links. This one test catches most real mistakes. Delete the test account afterward.

## 7. Open questions and next steps

1. **Language:** English now. Decide on Bangla or a mix. Keep all text in one file so it can be translated later.
2. **Real content:** the saved places, foods and example names are placeholders.
3. **Outfit step (screen 9):** a quick style and color choice for the date.
4. **Resend sender:** decide whether to buy a domain or use a free sender option, after checking Resend's current rules.
5. **Costs and limits to verify:** Supabase, Resend, passkey support.
6. **Design touch-ups:** screens 6, 7 and the Craving step (see section 4).

### Suggested build order

1. Project setup, sign-ups off, the two accounts, Row Level Security, two-factor.
2. Profiles, pairing and the Us page.
3. Date planner flow (with manual places and the Craving step), date request and confirmation.
4. Photo upload with 400 KB shrinking, albums and the gallery.
5. Notifications and email (Resend).
6. Settings and appearance.
7. Security test with a third account, backups, then hosting and launch.

## 8. Change log

- Removed closet pages, actions, notifications, and database objects.
- Added batched photo uploads, 400 KB image limits, thumbnails and fullscreen album viewing.
- Removed Google Maps place search, place picking from live results, the map preview and the Maps API key and costs.
- Places are now manual: name, optional address, optional pasted Maps link, plus a free Google Maps search link as a fallback.
- Added link-safety rules for pasted Maps links.
- Confirmed Resend for email.
- Made Craving its own step.
- Set the stack to latest stable Next.js with TypeScript on Supabase cloud, with hosting and GitHub later.
