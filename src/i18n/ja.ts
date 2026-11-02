/**
 * Every piece of the app's own text, in Japanese: the catalogue the English
 * one (`./en.ts`) is typed against, so a key missing from either side fails
 * the typecheck. Text with values in it is a function of an object; text
 * around a link is split into the parts before and after it.
 */
export const ja = {
  common: {
    pageTitle: ({ page, app }: { page: string; app: string }) => `${page} — ${app}`,
    menu: "メニュー",
    closeMenu: "メニューを閉じる",
    home: "ホーム",
    account: "アカウント",
    signIn: "サインイン",
    signOut: "サインアウト",
    close: "閉じる",
    pullToReload: "引き下げて更新",
    releaseToReload: "離して更新",
    reloading: "更新中…",
    dismiss: "閉じる",
    retry: "再試行",
  },
  turnstile: {
    unavailable: "この操作は使えません。このサーバーでは確認の仕組みが設定されていません。",
  },
  language: {
    label: "言語",
    saveFailed: "言語を保存できませんでした。もう一度お試しください。",
  },
  home: {
    signedIn: {
      before: "",
      afterEmail: " でサインインしています。プッシュ通知は",
      link: "アカウントページ",
      after: "からオンにできます。",
    },
    signedOut: {
      before: "メールアドレスで",
      link: "サインイン",
      after: "して始めましょう。パスワードは不要です。",
    },
  },
  login: {
    title: "サインイン",
    emailIntro: "メールアドレスを入力してください。8桁のサインインコードをお送りします。",
    emailLabel: "メールアドレス",
    sendCode: "コードを送信",
    newHere: "初めての方も、サインインするとアカウントが作られます。",
    waitForCheck: "確認が終わるまで少しお待ちください。",
    codeIntro: {
      before: "",
      after: " に8桁のコードを送りました。下に入力してサインインしてください。",
    },
    codeLabel: "サインインコード",
    signIn: "サインイン",
    codeHint:
      "コードが届かない、またはアドレスを間違えたときは、メールアドレスの入力に戻って送り直してください。",
    backToEmail: "メールアドレスの入力に戻る",
    passkeyButton: "パスキーでサインイン",
    passkeyNote: "パスキーは、メールアドレスでサインインした後にアカウントページから追加できます。",
    errors: {
      sendFailed: "コードを送信できませんでした。もう一度お試しください。",
      verifyFailed: "コードが正しくありません。もう一度お試しください。",
      expired:
        "コードの有効期限が切れました。メールアドレスの入力に戻って新しいコードを送ってください。",
      tooManyAttempts:
        "間違いが多すぎたため、このコードは使えなくなりました。メールアドレスの入力に戻って新しいコードを送ってください。",
      rateLimited: "試行が多すぎます。少し待ってからもう一度お試しください。",
      notAllowed: "このメールアドレスではサインインできません。",
      unavailable: "現在サインインできません。確認の仕組みが設定されていません。",
      checkFailed: "確認に失敗しました。もう一度お試しください。",
    },
  },
  passkeys: {
    title: "パスキー",
    intro:
      "メールのコードを待たずに、指紋・顔・画面ロックでサインインできます。メールアドレスでのサインインもこれまでどおり使えます。",
    none: "パスキーはまだありません。",
    unnamed: "パスキー",
    added: ({ date }: { date: string }) => `${date} に追加`,
    unsupported: "このブラウザはパスキーに対応していません。",
    addOnThisDevice: "この端末でパスキーを追加",
    addedOk: "パスキーを追加しました。",
    delete: "削除",
    deleteLabel: ({ label }: { label: string }) => `「${label}」を削除`,
    deleteConfirm: ({ label }: { label: string }) =>
      `「${label}」を削除しますか？このパスキーではサインインできなくなります。`,
    deleted: ({ label }: { label: string }) => `「${label}」を削除しました。`,
    deleteFailed: "パスキーを削除できませんでした。もう一度お試しください。",
    needsFreshSignIn:
      "安全のため、パスキーはメールのコードでサインインしてから1日以内にしか追加できません。サインアウトしてメールアドレスでサインインし直してから追加してください。",
    errors: {
      alreadyRegistered: "このパスキーはすでに登録されています。",
      addFailed: "パスキーを追加できませんでした。もう一度お試しください。",
      notFound:
        "このパスキーは登録されていません（削除された可能性があります）。メールアドレスでサインインしてください。",
      forbidden: "このアカウントではサインインできません。",
      signInFailed:
        "パスキーでサインインできませんでした。メールアドレスでサインインすることもできます。",
    },
    offer: {
      title: "次回はパスキーでサインインしますか？",
      body: "この端末の指紋・顔・画面ロックで、メールのコードを待たずにサインインできます。メールアドレスでのサインインもこれまでどおり使えます。",
      add: "パスキーを追加",
      notNow: "今はしない",
      doneTitle: "パスキーを追加しました",
      done: {
        before:
          "次回からはサインイン画面で「パスキーでサインイン」を選ぶと、コードを待たずにサインインできます。パスキーの確認と削除は",
        link: "アカウントページ",
        after: "でできます。",
      },
    },
  },
  account: {
    title: "アカウント",
    close: {
      title: "アカウントを閉じる",
      body: "アカウントを閉じると、アカウントとそのすべてのデータがすぐに削除されます。削除したデータは元に戻せません。",
      understand: "すべてのデータが削除され、元に戻せないことを理解しました",
      button: "アカウントを閉じてすべてのデータを削除",
      failed: "アカウントを閉じられませんでした。ページを再読み込みしてもう一度お試しください。",
    },
  },
  notifications: {
    title: "通知",
    notConfigured: "このサーバーではプッシュ通知が設定されていません。",
    checking: "この端末を確認しています…",
    unsupported: "このブラウザはプッシュ通知を受け取れません。",
    installFirst:
      "iPhone と iPad では、まずこのアプリをホーム画面に追加し、追加したアプリから通知をオンにしてください。",
    noWorker:
      "通知には Service Worker が必要で、ビルドしたアプリ（pnpm dev:cf またはデプロイ先）でしか登録されません。",
    denied:
      "このサイトの通知はブロックされています。ブラウザのサイト設定で許可してから、ページを再読み込みしてください。",
    offNote: "この端末で通知を受け取れます。",
    turnOn: "通知をオンにする",
    onNote: "この端末の通知はオンです。",
    sendTest: "テスト通知を送る",
    turnOff: "通知をオフにする",
    failed: "問題が発生しました。ページを再読み込みしてもう一度お試しください。",
    rateLimited: "テスト通知が多すぎます。1分ほど待ってからもう一度お試しください。",
    sent: ({ count }: { count: string; plural: Intl.LDMLPluralRule }) =>
      `${count} 台の端末に送りました。`,
    noneAccepted: "通知を受け取った端末はありませんでした。",
    test: {
      title: "テスト通知",
      body: "この端末でプッシュ通知が届いています。",
    },
  },
  install: {
    addToHomeScreen: "ホーム画面に追加",
    installApp: "アプリをインストール",
    ios: {
      title: "ホーム画面に追加する方法",
      steps: [
        "Safari で、画面下の共有ボタン（iPad では右上）をタップします。",
        "シートを下にスクロールして「ホーム画面に追加」をタップします。",
        "右上の「追加」をタップします。ホーム画面にアプリのアイコンが表示されます。",
      ],
      note: "ホーム画面のアプリは Safari のサインインを引き継がないため、初めて開いたときにもう一度サインインしてください。",
    },
    browser: {
      title: "アプリをインストールする方法",
      steps: [
        "右上のブラウザのメニュー（⋮）を開きます。",
        "「アプリをインストール」または「ホーム画面に追加」をタップして確定します。",
      ],
    },
  },
  email: {
    otp: {
      subject: ({ code, app }: { code: string; app: string }) =>
        `${app} のサインインコードは ${code} です`,
      intro: ({ app }: { app: string }) => `${app} のサインインコード:`,
      expires: ({ minutes }: { minutes: number }) => `このコードの有効期限は ${minutes} 分です。`,
      ignore: "心当たりがない場合は、このメールを無視してください。",
    },
    passkeyAdded: {
      subject: ({ app }: { app: string }) => `${app} のアカウントにパスキーが追加されました`,
      body: ({ name, app }: { name: string; app: string }) =>
        `${app} のアカウントに新しいパスキー「${name}」が追加されました。`,
      warning: "心当たりがない場合は、すぐにアカウントページから削除してください:",
      warningBefore: "心当たりがない場合は、すぐに",
      accountPage: "アカウントページ",
      warningAfter: "から削除してください。",
    },
  },
};
