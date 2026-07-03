import cfg from '@/config';

const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

let pickerLibPromise: Promise<void> | null = null;

function loadPickerLib(): Promise<void> {
  if (!pickerLibPromise) {
    pickerLibPromise = new Promise((resolve) => gapi.load('picker', resolve));
  }
  return pickerLibPromise;
}

export interface PickedSheet {
  id: string;
  name: string;
}

/**
 * Opens Google's file picker restricted to the Sheets view, so the user can select
 * a spreadsheet from anywhere in their Drive (including files only shared with them),
 * bypassing the drive.file scope's normal restriction to app-created/opened files.
 */
export async function openSheetPicker(accessToken: string): Promise<PickedSheet | null> {
  await loadPickerLib();
  const projectNumber = cfg.CLIENT_ID.split('-')[0];

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      .setMimeTypes(SPREADSHEET_MIME);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setAppId(projectNumber)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          resolve(doc ? { id: doc.id, name: doc.name } : null);
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}
