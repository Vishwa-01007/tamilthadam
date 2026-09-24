// Paste this file into the Apps Script project for the private learner sheet.
// In Apps Script > Project Settings > Script properties, add:
//   GOOGLE_SHEETS_SYNC_SECRET = the same secret configured on the website server
//   GOOGLE_SHEETS_SPREADSHEET_ID = the ID from your private spreadsheet URL
// Then deploy as a web app, executing as you. The sheet itself can stay private.

const LEARNER_SHEET_NAME = "Learners";
const LEARNER_HEADERS = [
  "User ID",
  "Username",
  "Email",
  "Learner Path",
  "Progress (JSON)",
  "Account Created",
  "Last Login",
  "Last Updated",
];

function doPost(event) {
  try {
    const payload = JSON.parse(event?.postData?.contents || "{}");
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty("GOOGLE_SHEETS_SYNC_SECRET");
    const spreadsheetId = properties.getProperty("GOOGLE_SHEETS_SPREADSHEET_ID");
    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }
    if (!spreadsheetId) {
      return jsonResponse({ ok: false, error: "Spreadsheet ID is not configured" });
    }

    const learner = payload.learner;
    if (!learner || !learner.id || !learner.email) {
      return jsonResponse({ ok: false, error: "Missing learner details" });
    }

    const workbook = SpreadsheetApp.openById(spreadsheetId);
    const sheet = workbook.getSheetByName(LEARNER_SHEET_NAME) || workbook.insertSheet(LEARNER_SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(LEARNER_HEADERS);
      sheet.setFrozenRows(1);
    }

    const currentRows = sheet.getDataRange().getValues();
    const existingIndex = currentRows.findIndex((row, index) => index > 0 && String(row[0]) === String(learner.id));
    const rowNumber = existingIndex >= 0 ? existingIndex + 1 : sheet.getLastRow() + 1;
    const safeCellText = (value) => {
      const text = String(value || "");
      return /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    };
    const row = [
      safeCellText(learner.id),
      safeCellText(learner.username),
      safeCellText(learner.email),
      safeCellText(learner.learnerPath),
      JSON.stringify(learner.progress || {}),
      safeCellText(learner.createdAt),
      safeCellText(learner.lastLoginAt),
      safeCellText(learner.updatedAt),
    ];
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Learner sync error:", error);
    return jsonResponse({ ok: false, error: "Could not save learner record" });
  }
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
