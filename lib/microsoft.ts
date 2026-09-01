import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser';

export type OutlookMessage = {
  id: string;
  subject?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  importance?: string;
  hasAttachments?: boolean;
  bodyPreview?: string;
  webLink?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  handled?: boolean;
};

const clientId=process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
const scopes=['Mail.Read'];

let instance: PublicClientApplication | null=null;
let initPromise: Promise<PublicClientApplication> | null=null;

async function getMsal(){
  if(!clientId) throw new Error('Microsoft Client ID is not configured.');
  if(instance) return instance;
  if(initPromise) return initPromise;
  initPromise=(async()=>{
    const app=new PublicClientApplication({
      auth:{
        clientId,
        authority:'https://login.microsoftonline.com/common',
        redirectUri:typeof window!=='undefined'?window.location.origin:''
      },
      cache:{cacheLocation:'localStorage'}
    });
    await app.initialize();
    await app.handleRedirectPromise();
    const accounts=app.getAllAccounts();
    if(accounts[0]) app.setActiveAccount(accounts[0]);
    instance=app;
    return app;
  })();
  return initPromise;
}

export async function getMicrosoftAccount():Promise<AccountInfo|null>{
  if(!clientId) return null;
  const app=await getMsal();
  return app.getActiveAccount()||app.getAllAccounts()[0]||null;
}

export async function connectMicrosoft(){
  const app=await getMsal();
  await app.loginRedirect({scopes,prompt:'select_account'});
}

export async function disconnectMicrosoft(){
  const app=await getMsal();
  const account=app.getActiveAccount()||app.getAllAccounts()[0];
  await app.logoutRedirect({account:account||undefined,postLogoutRedirectUri:window.location.origin});
}

async function token(){
  const app=await getMsal();
  const account=app.getActiveAccount()||app.getAllAccounts()[0];
  if(!account){
    await app.loginRedirect({scopes});
    throw new Error('Microsoft sign-in required.');
  }
  try{
    const result=await app.acquireTokenSilent({scopes,account});
    return result.accessToken;
  }catch(err){
    if(err instanceof InteractionRequiredAuthError){
      await app.acquireTokenRedirect({scopes,account});
      throw new Error('Microsoft consent required.');
    }
    throw err;
  }
}

// Blueprint is a working inbox, not a mirror of Outlook. Keep obvious promotional
// noise out while leaving the original message untouched in Outlook.
function isBlueprintNoise(message:OutlookMessage){
  const sender=(message.from?.emailAddress?.address||'').toLowerCase();
  const subject=(message.subject||'').toLowerCase();
  const preview=(message.bodyPreview||'').toLowerCase();
  const text=`${subject} ${preview}`;

  // Never suppress common operational/financial signals even when the sender is automated.
  const businessSignal=/\b(invoice|statement|remittance|payment|credit|overdue|order|purchase order|delivery|dispatch|shortage|complaint|account|price increase|vat|balance|action required)\b/i;
  if(businessSignal.test(text)) return false;

  const promotionalSender=/newsletter|marketing|promotions?|offers?|deals?|campaign|mailer|mailshot/i.test(sender);
  const promotionalSubject=/unsubscribe|newsletter|special offer|exclusive offer|save \d+%|sale now|shop now|limited time offer|weekly deals?|daily deals?|marketing update|promotional/i.test(text);
  const bulkMail=/unsubscribe|manage (your )?preferences|email preferences|view (this )?email in (your )?browser/i.test(preview);

  return promotionalSender||promotionalSubject||bulkMail;
}

export async function getInboxMessages(top=30):Promise<OutlookMessage[]>{
  const accessToken=await token();
  // Fetch a wider window because Blueprint filters promotional noise after retrieval.
  const fetchTop=Math.min(Math.max(top*3,top),100);
  const params=new URLSearchParams({
    '$top':String(fetchTop),
    '$select':'id,subject,receivedDateTime,isRead,importance,hasAttachments,bodyPreview,webLink,from',
    '$orderby':'receivedDateTime desc'
  });
  const res=await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${params.toString()}`,{
    headers:{Authorization:`Bearer ${accessToken}`}
  });
  if(!res.ok){
    const detail=await res.text();
    throw new Error(`Outlook ${res.status}: ${detail.slice(0,180)}`);
  }
  const data=await res.json();
  return ((data.value||[]) as OutlookMessage[]).filter(message=>!isBlueprintNoise(message)).slice(0,top);
}
