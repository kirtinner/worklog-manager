import { getStoredReportsSaveDirectoryHandle } from "./reportExportDirectoryStorage";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const REPORTS_SAVE_PICKER_ID = "reports-export";
const REPORTS_SAVE_DIALOG_USED_KEY = "dev-productivity:reports-export-dialog-used";

const encoder = new TextEncoder();

function xmlEscape(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&apos;");
}

function toUtf8Bytes(value) {
    return value instanceof Uint8Array ? value : encoder.encode(String(value));
}

const crcTable = (() => {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
        let crc = index;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc & 1) !== 0 ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
        table[index] = crc >>> 0;
    }

    return table;
})();

function crc32(bytes) {
    let crc = 0xFFFFFFFF;

    for (const byte of bytes) {
        crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint16LE(view, offset, value) {
    view.setUint16(offset, value, true);
}

function writeUint32LE(view, offset, value) {
    view.setUint32(offset, value, true);
}

function createZipFile(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    entries.forEach(entry => {
        const nameBytes = toUtf8Bytes(entry.name);
        const dataBytes = toUtf8Bytes(entry.data);
        const crc = crc32(dataBytes);

        const localHeader = new Uint8Array(30);
        const localView = new DataView(localHeader.buffer);
        writeUint32LE(localView, 0, 0x04034b50);
        writeUint16LE(localView, 4, 20);
        writeUint16LE(localView, 6, 0);
        writeUint16LE(localView, 8, 0);
        writeUint16LE(localView, 10, 0);
        writeUint16LE(localView, 12, 0);
        writeUint32LE(localView, 14, crc);
        writeUint32LE(localView, 18, dataBytes.length);
        writeUint32LE(localView, 22, dataBytes.length);
        writeUint16LE(localView, 26, nameBytes.length);
        writeUint16LE(localView, 28, 0);

        localParts.push(localHeader, nameBytes, dataBytes);

        const centralHeader = new Uint8Array(46);
        const centralView = new DataView(centralHeader.buffer);
        writeUint32LE(centralView, 0, 0x02014b50);
        writeUint16LE(centralView, 4, 20);
        writeUint16LE(centralView, 6, 20);
        writeUint16LE(centralView, 8, 0);
        writeUint16LE(centralView, 10, 0);
        writeUint16LE(centralView, 12, 0);
        writeUint16LE(centralView, 14, 0);
        writeUint32LE(centralView, 16, crc);
        writeUint32LE(centralView, 20, dataBytes.length);
        writeUint32LE(centralView, 24, dataBytes.length);
        writeUint16LE(centralView, 28, nameBytes.length);
        writeUint16LE(centralView, 30, 0);
        writeUint16LE(centralView, 32, 0);
        writeUint16LE(centralView, 34, 0);
        writeUint16LE(centralView, 36, 0);
        writeUint32LE(centralView, 38, 0);
        writeUint32LE(centralView, 42, offset);

        centralParts.push(centralHeader, nameBytes);
        offset += localHeader.length + nameBytes.length + dataBytes.length;
    });

    const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    writeUint32LE(endView, 0, 0x06054b50);
    writeUint16LE(endView, 4, 0);
    writeUint16LE(endView, 6, 0);
    writeUint16LE(endView, 8, entries.length);
    writeUint16LE(endView, 10, entries.length);
    writeUint32LE(endView, 12, centralDirectorySize);
    writeUint32LE(endView, 16, offset);
    writeUint16LE(endView, 20, 0);

    return new Blob([...localParts, ...centralParts, endRecord], { type: XLSX_MIME });
}

function buildSheetXml(reportData) {
    const rows = [];
    let rowIndex = 1;

    const addRow = (cells, attrs = "", explicitRowIndex = null) => {
        const currentRowIndex = explicitRowIndex ?? rowIndex;
        const rowCells = cells.join("");
        rows.push(`<row r="${currentRowIndex}"${attrs}>${rowCells}</row>`);
        rowIndex = currentRowIndex + 1;
    };

    const inlineCell = (reference, value, style = 0) => {
        if (value == null || value === "") {
            return "";
        }

        return `<c r="${reference}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t>${xmlEscape(value)}</t></is></c>`;
    };

    const numberCell = (reference, value, style = 0) => {
        return `<c r="${reference}"${style ? ` s="${style}"` : ""}><v>${Number(value ?? 0).toFixed(2)}</v></c>`;
    };

    addRow([
        inlineCell("A1", "Work Effort Report for Period", 1)
    ]);

    addRow([
        inlineCell("A2", `Period: ${reportData.from ?? ""} - ${reportData.to ?? ""}`, 2)
    ]);

    addRow([]);

    addRow([
        inlineCell("A4", "Client", 2),
        inlineCell("B4", "Task", 2),
        inlineCell("C4", "Hours", 2)
    ], "", 4);

    reportData.clients.forEach(client => {
        addRow([
            inlineCell(`A${rowIndex}`, client.clientName ?? "", 3),
            inlineCell(`B${rowIndex}`, "", 3),
            numberCell(`C${rowIndex}`, client.totalHours, 4)
        ]);

        (client.tasks ?? []).forEach(task => {
            addRow([
                inlineCell(`A${rowIndex}`, "", 0),
                inlineCell(`B${rowIndex}`, task.taskName ?? "", 0),
                numberCell(`C${rowIndex}`, task.hours, 5)
            ]);
        });
    });

    addRow([
        inlineCell(`A${rowIndex}`, "Grand Total", 6),
        inlineCell(`B${rowIndex}`, "", 6),
        numberCell(`C${rowIndex}`, reportData.grandTotalHours, 7)
    ]);

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="28" customWidth="1"/>
    <col min="2" max="2" width="52" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
  </cols>
  <sheetData>
    ${rows.join("\n    ")}
  </sheetData>
  <mergeCells count="1">
    <mergeCell ref="A1:C1"/>
  </mergeCells>
</worksheet>`;
}

function buildWorkbookFiles(reportData) {
    const sheetXml = buildSheetXml(reportData);
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Report" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

    const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <color theme="1"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color theme="1"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="4">
    <fill>
      <patternFill patternType="none"/>
    </fill>
    <fill>
      <patternFill patternType="gray125"/>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="DCEBF9"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="E4EFFD"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="1">
    <border>
      <left/>
      <right/>
      <top/>
      <bottom/>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="2" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>
    <xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="2" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

    const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Dev Productivity Platform</Application>
</Properties>`;

    const now = new Date().toISOString();
    const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:dcmitype="http://purl.org/dc/dcmitype/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Work Effort Report for Period</dc:title>
  <dc:creator>Dev Productivity Platform</dc:creator>
  <cp:lastModifiedBy>Dev Productivity Platform</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;

    return [
        { name: "[Content_Types].xml", data: contentTypesXml },
        { name: "_rels/.rels", data: rootRelsXml },
        { name: "xl/workbook.xml", data: workbookXml },
        { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
        { name: "xl/worksheets/sheet1.xml", data: sheetXml },
        { name: "xl/styles.xml", data: stylesXml },
        { name: "docProps/app.xml", data: appXml },
        { name: "docProps/core.xml", data: coreXml }
    ];
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
}

export async function exportWorkEffortReportToXlsx(reportData) {
    const blob = createZipFile(buildWorkbookFiles(reportData));
    const fileName = `work-effort-report-${reportData.from ?? "period"}-to-${reportData.to ?? "period"}.xlsx`;
    const directoryHandle = await getStoredReportsSaveDirectoryHandle();
    const hasManualSaveHistory = localStorage.getItem(REPORTS_SAVE_DIALOG_USED_KEY) === "true";

    if (window.showSaveFilePicker) {
        const pickerOptions = {
            id: REPORTS_SAVE_PICKER_ID,
            suggestedName: fileName,
            types: [
                {
                    description: "Excel Workbook",
                    accept: {
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"]
                    }
                }
            ]
        };

        if (directoryHandle && !hasManualSaveHistory) {
            pickerOptions.startIn = directoryHandle;
        }

        try {
            const fileHandle = await window.showSaveFilePicker(pickerOptions);
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            localStorage.setItem(REPORTS_SAVE_DIALOG_USED_KEY, "true");
            return;
        } catch (error) {
            if (error?.name === "AbortError") {
                return;
            }

            if (error?.name === "TypeError" && pickerOptions.startIn) {
                try {
                    const retryOptions = { ...pickerOptions };
                    delete retryOptions.startIn;
                    const fileHandle = await window.showSaveFilePicker(retryOptions);
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    localStorage.setItem(REPORTS_SAVE_DIALOG_USED_KEY, "true");
                    return;
                } catch (retryError) {
                    if (retryError?.name === "AbortError") {
                        return;
                    }
                    throw retryError;
                }
            }

            throw error;
        }
    }

    downloadBlob(blob, fileName);
}
