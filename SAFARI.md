# Safari Web Extension

This project can be packaged as a macOS Safari Web Extension with Apple's
`safari-web-extension-converter`.

## Build a Safari Project

Run from the project root:

```sh
./scripts/build-safari-project.sh
```

The generated Xcode project will be created outside this repository at:

```text
../ChatGPT Long Conversation Toolkit
```

Open the `.xcodeproj`, select the macOS app scheme, set the same signing team
for the app target and extension target, then build and run.

## Enable in Safari

1. Open Safari.
2. Enable developer features if needed:
   `Safari > Settings > Advanced > Show features for web developers`.
3. For local unsigned testing, choose:
   `Develop > Allow Unsigned Extensions`.
4. Enable the extension in:
   `Safari > Settings > Extensions`.

## Notes

- Safari requires the extension to be embedded in a signed macOS app.
- The included `safari-api.js` keeps the existing `chrome.*` extension code
  compatible with Safari builds that expose the WebExtension APIs through
  `browser.*`.
- The generated Xcode project is intentionally not committed; it can be
  regenerated when needed.
