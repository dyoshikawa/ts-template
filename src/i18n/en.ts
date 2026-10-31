import { type Messages } from "./messages";

/** The English catalogue, typed against the Japanese one (`./ja.ts`). */
export const en: Messages = {
  common: {
    pageTitle: ({ page, app }) => `${page} — ${app}`,
    menu: "Menu",
    closeMenu: "Close menu",
    home: "Home",
    account: "Account",
    signIn: "Sign in",
    signOut: "Sign out",
    close: "Close",
    pullToReload: "Pull to reload",
    releaseToReload: "Release to reload",
    reloading: "Reloading…",
    dismiss: "Dismiss",
    retry: "Retry",
  },
  turnstile: {
    unavailable: "This action is unavailable: the verification check is not set up on this server.",
  },
  language: {
    label: "Language",
    saveFailed: "Could not save the language. Please try again.",
  },
  home: {
    signedIn: {
      before: "Signed in as ",
      afterEmail: ". Turn on push notifications from your ",
      link: "account",
      after: ".",
    },
    signedOut: {
      before: "",
      link: "Sign in",
      after: " with your email address to get started. No password needed.",
    },
  },
  login: {
    title: "Sign in",
    emailIntro: "Enter your email address and we will send you an 8-digit sign-in code.",
    emailLabel: "Email address",
    sendCode: "Send code",
    newHere: "New here? Signing in creates your account.",
    waitForCheck: "Wait a moment for the check to finish.",
    codeIntro: {
      before: "We sent an 8-digit code to ",
      after: ". Enter it below to sign in.",
    },
    codeLabel: "Sign-in code",
    signIn: "Sign in",
    codeHint: "No code, or the wrong address? Go back to the email step to send a new one.",
    backToEmail: "Back to the email step",
    passkeyButton: "Sign in with a passkey",
    passkeyNote: "Add a passkey from your account page after signing in with your email address.",
    errors: {
      sendFailed: "Could not send the code. Please try again.",
      verifyFailed: "That code is not right. Please try again.",
      expired: "The code has expired. Go back to the email step to send a new one.",
      tooManyAttempts:
        "Too many wrong tries: this code no longer works. Go back to the email step to send a new one.",
      rateLimited: "Too many tries. Wait a moment and try again.",
      notAllowed: "This email address cannot sign in.",
      unavailable: "Sign-in is not available: the verification check is not set up.",
      checkFailed: "The check failed. Please try again.",
    },
  },
  passkeys: {
    title: "Passkeys",
    intro:
      "Sign in with your fingerprint, face or screen lock instead of waiting for an email code. Signing in by email keeps working as before.",
    none: "No passkeys yet.",
    unnamed: "Passkey",
    added: ({ date }) => `Added ${date}`,
    unsupported: "This browser does not support passkeys.",
    addOnThisDevice: "Add a passkey on this device",
    addedOk: "Passkey added.",
    delete: "Delete",
    deleteLabel: ({ label }) => `Delete "${label}"`,
    deleteConfirm: ({ label }) =>
      `Delete "${label}"? You will no longer be able to sign in with it.`,
    deleted: ({ label }) => `Deleted "${label}".`,
    deleteFailed: "Could not delete the passkey. Please try again.",
    needsFreshSignIn:
      "For your security, passkeys can only be added within a day of signing in with an email code. Sign out, sign in again with your email address, then add the passkey.",
    errors: {
      alreadyRegistered: "This passkey is already registered.",
      addFailed: "Could not add the passkey. Please try again.",
      notFound:
        "This passkey is not registered (it may have been deleted). Sign in with your email address instead.",
      forbidden: "This account cannot sign in.",
      signInFailed:
        "Could not sign in with the passkey. You can sign in with your email address instead.",
    },
    offer: {
      title: "Sign in with a passkey next time?",
      body: "Use this device's fingerprint, face or screen lock to sign in without waiting for an email code. Signing in by email keeps working as before.",
      add: "Add a passkey",
      notNow: "Not now",
      doneTitle: "Passkey added",
      done: {
        before:
          'Next time, choose "Sign in with a passkey" on the sign-in page instead of waiting for a code. You can review and delete your passkeys on your ',
        link: "account page",
        after: ".",
      },
    },
  },
  account: {
    title: "Account",
    close: {
      title: "Close account",
      body: "Closing your account deletes it and all of its data right away. Deleted data cannot be recovered.",
      understand: "I understand that all my data will be deleted and cannot be restored",
      button: "Close account and delete all data",
      failed: "Could not close the account. Reload the page and try again.",
    },
  },
  notifications: {
    title: "Notifications",
    notConfigured: "Push notifications are not configured on this server.",
    checking: "Checking this device…",
    unsupported: "This browser cannot receive push notifications.",
    installFirst:
      "On iPhone and iPad, add this app to your Home Screen first, then turn notifications on from the installed app.",
    noWorker:
      "Notifications need the service worker, which only the built app registers (pnpm dev:cf or a deployment).",
    denied:
      "Notifications are blocked for this site. Allow them in the browser's site settings, then reload the page.",
    offNote: "Get notified on this device.",
    turnOn: "Turn on notifications",
    onNote: "Notifications are on for this device.",
    sendTest: "Send a test notification",
    turnOff: "Turn off notifications",
    failed: "Something went wrong. Reload the page and try again.",
    rateLimited: "Too many test notifications. Wait a minute and try again.",
    sent: ({ count, plural }) => `Sent to ${count} ${plural === "one" ? "device" : "devices"}.`,
    noneAccepted: "No device accepted the notification.",
    test: {
      title: "Test notification",
      body: "Push notifications are working on this device.",
    },
  },
  install: {
    addToHomeScreen: "Add to Home Screen",
    installApp: "Install app",
    ios: {
      title: "How to add to your Home Screen",
      steps: [
        "In Safari, tap the Share button at the bottom of the screen (top right on iPad).",
        "Scroll down the sheet and tap “Add to Home Screen”.",
        "Tap “Add” at the top right. The app's icon appears on your Home Screen.",
      ],
      note: "The Home Screen app does not share Safari's sign-in, so sign in once more the first time you open it.",
    },
    browser: {
      title: "How to install the app",
      steps: [
        "Open the browser's menu (⋮) at the top right.",
        "Tap “Install app” or “Add to Home Screen” and confirm.",
      ],
    },
  },
  email: {
    otp: {
      subject: ({ code, app }) => `${code} is your ${app} sign-in code`,
      intro: ({ app }) => `Your ${app} sign-in code is:`,
      expires: ({ minutes }) => `The code expires in ${minutes} minutes.`,
      ignore: "If you did not ask for it, you can ignore this email.",
    },
    passkeyAdded: {
      subject: ({ app }) => `A passkey was added to your ${app} account`,
      body: ({ name, app }) => `A new passkey, "${name}", was added to your ${app} account.`,
      warning: "If you did not add it, delete it from your account page right away:",
      warningBefore: "If you did not add it, delete it from your ",
      accountPage: "account page",
      warningAfter: " right away.",
    },
  },
};
