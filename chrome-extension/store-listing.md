# Freepik Downloader Chrome Web Store Listing

## Suggested Title

Freepik Downloader

## Summary

Open the current Magnific/Freepik resource, confirm it, and trigger download in one click.

## Detailed Description

Freepik Downloader is a lightweight Chrome extension for people who use Magnific/Freepik resources with their own API key.

What it does:

- Detects when the current tab is a valid Magnific or Freepik resource page
- Lets you launch your downloader flow from the extension popup
- Adds a floating button directly on supported resource pages
- Downloads through the official Magnific API using the API key stored in Chrome sync storage
- Can fall back to opening your deployed downloader app when no key is saved in the extension

Typical workflow:

1. Configure your downloader app URL once
2. Open a Magnific or Freepik resource page
3. Click the extension icon or the floating action button
4. Confirm and open the downloader app
5. Let the extension or app request the official Magnific download

This extension stores the API key only in Chrome sync storage and uses it to request the official Magnific download URL. It reads only the current supported tab URL needed for the download flow.

## Single Purpose Description

Download or launch the companion downloader web app for the currently open Magnific/Freepik resource page.

## Permissions Justification

- `tabs`: needed to read the active tab URL and title so the extension can confirm the current page is a supported resource
- `storage`: needed to save the API key configured by the user
- `downloads`: needed to start the browser download after Magnific returns a signed URL
- `https://freepik.com/*`, `https://*.freepik.com/*`, `https://magnific.com/*`, `https://*.magnific.com/*`: needed to show the floating button only on supported pages
- `https://api.magnific.com/*`: needed to request the official download URL

## Privacy Practices

- The extension does not collect or sell user data
- The extension does not send browsing history to any third party
- The extension stores only the user-provided API key in Chrome sync storage
- The extension reads the current supported tab URL only to identify the resource ID

## Recommended Category

Productivity

## Support URL

Use your project homepage or repository URL.

## Privacy Policy URL

Use the deployed URL for:

`https://YOUR-DOMAIN/privacy-policy.html`
