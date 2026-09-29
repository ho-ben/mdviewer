# Google Play internal release checklist

The native app is designed for normal Play Store installation. It is not a sideloaded APK and does not ask the user to disable Android security protections.

## Before the first upload

- Confirm the permanent application ID: `io.github.hoben.mdviewer`.
- Run `pnpm test` and `pnpm android:prepare` from the repository root.
- In Android Studio, open `android/`, then choose **Build > Generate Signed App Bundle or APK > Android App Bundle**.
- Create an upload key, store it and its passwords in a password manager plus a secure backup, and never commit it to Git.
- Keep Google Play App Signing enabled. The local upload key signs submissions; Google protects the app-signing key used for installs.

## Play Console

1. Create an app named **MD Viewer**, choose **App**, **Free**, and the appropriate developer/contact details.
2. Complete the basic app-content forms. This app has no ads, account, login, restricted content, or special access requirements.
3. Add `https://ho-ben.github.io/mdviewer/privacy.html` as the privacy-policy URL.
4. For Data safety, the current build collects and shares no user data. Re-check this declaration if analytics, crash reporting, networking, ads, or any other SDK is added later.
5. Create an **Internal testing** release and upload the signed `.aab`.
6. Add the Google account used on the Pixel to the tester list, roll out the release, and open the generated opt-in link on the phone.
7. Install from Google Play. Android will then offer MD Viewer in **Share** and **Open with** for supported text files when the source app supplies a compatible MIME type.

Internal testing supports up to 100 testers and normally makes a new bundle available within minutes. Apps exclusively on the internal track are currently exempt from the public Data safety section, but the privacy policy is already available for later closed or production releases.

## Suggested store text

**Short description**

Read Markdown, equations, logs, and text files privately and offline.

**Full description**

MD Viewer opens Markdown and common text files directly from Android's Share and Open with menus. It supports CommonMark and GitHub-flavored Markdown, tables, task lists, strikethrough, syntax-highlighted code, KaTeX equations, footnotes, Mermaid diagrams, and more.

Keep several documents open in tabs, use the full-height scroll grabber for long files, and switch between light and dark themes. Files are rendered locally. The app has no ads, analytics, account, storage permission, or Internet permission.

## Updating

For every Play update, increment `versionCode` in `android/app/build.gradle.kts`, update `versionName` as appropriate, regenerate the bundled web assets, and upload a newly signed `.aab` made with the same upload key.
