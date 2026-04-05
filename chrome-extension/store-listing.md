# Freepik Downloader Chrome Web Store Listing

## Suggested Title

Freepik Downloader

## Summary

Open the current Freepik resource in your downloader app, confirm it, and trigger download in one click.

## Detailed Description

Freepik Downloader is a lightweight Chrome extension for people who already use the companion web app to manage Freepik downloads with their own API key.

What it does:

- Detects when the current tab is a valid Freepik resource page
- Lets you launch your downloader flow from the extension popup
- Adds a floating button directly on supported Freepik pages
- Opens your deployed downloader app and passes the current resource URL automatically
- Keeps API key handling inside your existing downloader web app domain

Typical workflow:

1. Configure your downloader app URL once
2. Open a Freepik resource page
3. Click the extension icon or the floating action button
4. Confirm and open the downloader app
5. Let the app validate the resource and request the official Freepik download

This extension does not store your Freepik API key and does not call the Freepik API directly. It only reads the current Freepik tab URL and opens your own downloader web app with that URL.

## Single Purpose Description

Launch the companion downloader web app for the currently open Freepik resource page.

## Permissions Justification

- `tabs`: needed to read the active tab URL and title so the extension can confirm the current page is a Freepik resource
- `storage`: needed to save the downloader app URL configured by the user
- `https://*.freepik.com/*`: needed to show the floating button only on matching Freepik pages

## Privacy Practices

- The extension does not collect or sell user data
- The extension does not send browsing history to any third party
- The extension stores only the downloader app URL in Chrome sync storage
- The extension reads the current Freepik tab URL only to open the configured downloader app

## Recommended Category

Productivity

## Support URL

Use your project homepage or repository URL.

## Privacy Policy URL

Use the deployed URL for:

`https://YOUR-DOMAIN/privacy-policy.html`
