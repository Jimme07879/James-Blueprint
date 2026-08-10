# Connect Outlook to Blueprint OS 5.2

Blueprint uses Microsoft Graph with delegated `Mail.Read` permission. This means Blueprint reads the mailbox of the Microsoft account you explicitly sign into; it does not use a background app-only mailbox permission.

## 1. Create the Microsoft app registration
Go to Microsoft Entra admin center → App registrations → New registration.

Suggested name:
`Blueprint OS - Steve Ops`

Supported account types:
`Accounts in any organizational directory and personal Microsoft accounts`

## 2. Add the redirect URI
Under Authentication, add a **Single-page application (SPA)** redirect URI:

`https://james-blueprint.vercel.app`

If you use a different production domain, add that exact origin instead.

Optional for local testing:
`http://localhost:3000`

Do not create a client secret for this browser-based integration.

## 3. Add Microsoft Graph permission
API permissions → Add a permission → Microsoft Graph → Delegated permissions → `Mail.Read`.

## 4. Copy the Application (client) ID
From the app registration Overview page, copy **Application (client) ID**.

## 5. Add it to Vercel
Vercel → james-blueprint → Settings → Environment Variables.

Name:
`NEXT_PUBLIC_MICROSOFT_CLIENT_ID`

Value:
your Application (client) ID

Apply to Production and Preview, save, then redeploy.

## 6. Connect from Blueprint
Open Blueprint OS → Email → Connect Outlook.

Microsoft will ask you to sign in and consent to reading mail.

## Privacy
The Microsoft access token is managed by MSAL in the browser cache. Blueprint requests delegated Mail.Read and does not need a Microsoft client secret.
