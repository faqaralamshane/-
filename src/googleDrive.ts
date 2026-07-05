/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    google: any;
  }
}

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('فشل تحميل مكتبة تسجيل دخول جوجل'));
    document.head.appendChild(script);
  });
}

export async function uploadToGoogleDrive(
  jsonString: string,
  clientId: string,
  folderId?: string
): Promise<string> {
  if (!clientId) {
    throw new Error('لم يتم إدخال Google OAuth Client ID في الإعدادات');
  }

  await loadGoogleScript();

  return new Promise<string>((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(`فشل الحصول على تفويض جوجل: ${tokenResponse.error_description || tokenResponse.error}`));
            return;
          }

          const accessToken = tokenResponse.access_token;
          try {
            const fileId = await performDriveUpload(accessToken, jsonString, folderId);
            resolve(fileId);
          } catch (err: any) {
            reject(err);
          }
        }
      });

      client.requestAccessToken({ prompt: '' });
    } catch (err: any) {
      reject(new Error(`خطأ في تهيئة تسجيل الدخول: ${err.message}`));
    }
  });
}

async function performDriveUpload(accessToken: string, jsonString: string, folderId?: string): Promise<string> {
  const filename = `faqar_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  
  const metadata: any = {
    name: filename,
    mimeType: 'application/json'
  };

  if (folderId && folderId.trim()) {
    metadata.parents = [folderId.trim()];
  }

  const boundary = 'foo_bar_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: body
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`فشل رفع الملف لجوجل درايف: ${errText || response.statusText}`);
  }

  const result = await response.json();
  return result.id;
}
