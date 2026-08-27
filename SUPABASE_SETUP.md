# BetterIG launch checklist

The website is already configured for:

- GitHub Pages: `https://growflow-ck.github.io/BetterIG/`
- Supabase project: `duimvrrtqezpksibbuzo`

Only the public Supabase publishable key is stored in `config.js`. Never add the database password, secret key, service-role key, or GitHub OAuth client secret to this repository.

## 1. Install the database

1. Open the Supabase project dashboard.
2. Open **SQL Editor** and choose **New query**.
3. Open `supabase/migrations/20260827000000_betterig.sql` from this project.
4. Copy the entire file into the query editor.
5. Click **Run** once.
6. Confirm that the result says the query completed successfully.

The migration creates the profiles, likes, scroll-event, and game-round tables. It also installs protected database functions for awarding points and resolving games.

## 2. Configure allowed website URLs

In Supabase, open **Authentication → URL Configuration** and set:

- **Site URL:** `https://growflow-ck.github.io/BetterIG/`
- **Redirect URL:** `https://growflow-ck.github.io/BetterIG/`

Save the changes. Keep the final slash.

## 3. Create the GitHub OAuth application

1. In GitHub, open **Settings → Developer settings → OAuth Apps**.
2. Select **New OAuth App**.
3. Enter:
   - **Application name:** `BetterIG`
   - **Homepage URL:** `https://growflow-ck.github.io/BetterIG/`
   - **Authorization callback URL:** `https://duimvrrtqezpksibbuzo.supabase.co/auth/v1/callback`
4. Register the application.
5. Generate a client secret.
6. Keep the GitHub page open for the next step.

## 4. Enable GitHub sign-in in Supabase

1. In Supabase, open **Authentication → Sign In / Providers → GitHub**.
2. Enable GitHub.
3. Paste the GitHub OAuth **Client ID** and **Client secret**.
4. Save.

The GitHub client secret belongs only in the Supabase dashboard. Do not put it in `config.js` or GitHub.

## 5. Publish the updated website

Upload the full contents of this `BetterIG` folder to the root of `growflow-ck/BetterIG`, including:

- `index.html`
- `styles.css`
- `app.js`
- `backend.js`
- `config.js`
- `assets/`
- `supabase/`

Commit the changes to the `main` branch. GitHub Pages will redeploy automatically.

## 6. Test the release

1. Open `https://growflow-ck.github.io/BetterIG/` in a private/incognito window.
2. Select **Continue with GitHub**.
3. Authorize BetterIG.
4. Choose a BetterIG username.
5. Complete several reel scrolls.
6. Open the leaderboard and confirm your account appears.
7. Like a reel, sign out, sign back in, and confirm the like and score remain.
8. Ask one friend to create an account and confirm both names appear on the same leaderboard.

New accounts start at zero. Old local-only scores are deliberately not imported because browser storage can be edited and cannot be trusted for a shared leaderboard.
