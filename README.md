# Ace Predict Pro

Full App Architecture & UI Design

Role: Senior React Native / Flutter Developer

Task: Build a dark-themed sports prediction app named ACE PREDICT using a premium black (#0B0E14), gold (#E2B714), and neon green (#00E676) aesthetic.

Requirements:

No-Login Experience: Users do not need to register or log in. The app opens directly to the predictions dashboard.

Header: Show the app title "ACE PREDICT", a badge for "Weekly Accuracy: 84%", and a date selector bar (Today, Tomorrow, Sat, Sun).

Prediction List:

Free Predictions: Cards displaying Match Teams, League Name, Kickoff Time, Prediction (e.g., "Home Win @ 1.80"), and a Confidence Badge.

VIP/Premium Predictions: Match details and prediction are blurred or covered with a gold lock icon. Contains a prominent call-to-action button: "WATCH AD TO UNLOCK PICK".

Rewarded Ad Flow: Integrate Google AdMob rewarded ad trigger. When the user taps "WATCH AD TO UNLOCK PICK", simulate or call the rewarded ad callback. Upon completion, save the unlocked state locally (using MMKV or AsyncLocalStorage) and reveal the prediction card.

Secret Admin Gateway:

Place a small, subtle white dot (width: 12px, height: 12px, opacity: 0.3) in the bottom right corner of the screen.

When tapped 5 times in rapid succession, open a sleek dark PIN Pad Modal overlay asking for an "Admin Access Passcode".

If the entered PIN matches the hashed secret key, open the Admin Upload Screen.

Admin Upload Screen:

Form fields to input: Team A, Team B, League Name, Match Time, Odds, Prediction, and Confidence Level (%).

An image picker button to upload a screenshot of a betting slip.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/705d5481-2b85-4f85-84a8-a24de40e8702).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
