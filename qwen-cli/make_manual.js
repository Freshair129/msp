const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, ExternalHyperlink
} = require('docx');
const fs = require('fs');

const BRAND_BLUE = "1E4D8C";
const LIGHT_BLUE = "D6E4F7";
const MID_BLUE = "2E75B6";
const GRAY_BG = "F5F5F5";
const CODE_BG = "EEEEEE";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: MID_BLUE, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 32, color: BRAND_BLUE, font: "Arial" })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, size: 26, color: MID_BLUE, font: "Arial" })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22, color: "444444", font: "Arial" })]
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 22, font: "Arial", ...opts })]
  });
}

function code(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: 360 },
    shading: { fill: CODE_BG, type: ShadingType.CLEAR },
    children: [new TextRun({ text, font: "Courier New", size: 18, color: "1A1A1A" })]
  });
}

function bullet(text, bold_part = "") {
  const runs = [];
  if (bold_part) {
    runs.push(new TextRun({ text: bold_part, bold: true, size: 22, font: "Arial" }));
    runs.push(new TextRun({ text, size: 22, font: "Arial" }));
  } else {
    runs.push(new TextRun({ text, size: 22, font: "Arial" }));
  }
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: runs
  });
}

function spacer(size = 120) {
  return new Paragraph({ spacing: { before: size, after: 0 }, children: [new TextRun("")] });
}

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      borders,
      shading: { fill: BRAND_BLUE, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20, font: "Arial" })] })]
    }))
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      borders,
      shading: { fill: ri % 2 === 0 ? "FFFFFF" : GRAY_BG, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, font: "Arial" })] })]
    }))
  }));
  return new Table({ width: { size: totalWidth, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...dataRows] });
}

const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: BRAND_BLUE, font: "Arial" },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: MID_BLUE, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: "444444", font: "Arial" },
        paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: MID_BLUE, space: 4 } },
          children: [
            new TextRun({ text: "qwen CLI", bold: true, color: BRAND_BLUE, font: "Arial", size: 20 }),
            new TextRun({ text: "  \u2014  คู่มือการใช้งาน", color: "666666", font: "Arial", size: 20 }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: MID_BLUE, space: 4 } },
          children: [
            new TextRun({ text: "หน้า ", color: "666666", size: 18, font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], color: "666666", size: 18, font: "Arial" }),
          ]
        })]
      })
    },
    children: [
      // ===== COVER =====
      spacer(1440),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [new TextRun({ text: "qwen", bold: true, size: 96, color: BRAND_BLUE, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
        children: [new TextRun({ text: "Local LLM CLI Tool", size: 36, color: MID_BLUE, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "คู่มือการใช้งาน", size: 28, color: "555555", font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 1440 },
        children: [new TextRun({ text: "เวอร์ชัน 1.0  |  เชื่อมต่อกับ Ollama", size: 22, color: "888888", font: "Arial" })]
      }),
      new Paragraph({ children: [new TextRun({ children: ["\f"] }) ] }), // page break

      // ===== SECTION 1 =====
      h1("1. ภาพรวม"),
      para("qwen คือ command-line tool ที่ใช้สั่งงาน AI โมเดลที่รันอยู่ในเครื่อง (Local LLM) ผ่าน Ollama โดยไม่ต้องเชื่อมต่ออินเทอร์เน็ตหรือส่งข้อมูลออกไปภายนอก เหมาะสำหรับงานเขียนโค้ด ตรวจสอบโค้ด และสร้างเอกสาร"),
      spacer(80),
      para("ข้อดีหลัก:", { bold: true }),
      bullet("ทำงานออฟไลน์ 100% ข้อมูลไม่ออกจากเครื่อง"),
      bullet("เรียกใช้จาก terminal ได้เลย ไม่ต้องเปิด browser"),
      bullet("รองรับการ pipe ข้อมูลจากไฟล์หรือโปรแกรมอื่น"),
      bullet("เลือกโมเดลได้ตามงาน เช่น เขียนโค้ด หรือ review"),
      spacer(120),

      // ===== SECTION 2 =====
      h1("2. ความต้องการของระบบ"),
      makeTable(
        ["ซอฟต์แวร์", "เวอร์ชัน", "หมายเหตุ"],
        [
          ["Python", "3.8 ขึ้นไป", "ติดตั้งอยู่ที่ AppData\\Local\\Programs\\Python\\Python313"],
          ["Ollama", "ล่าสุด", "ต้องรันอยู่ก่อนใช้งาน (localhost:11434)"],
          ["requests", "ใดก็ได้", "ติดตั้งอัตโนมัติพร้อม qwen-cli"],
        ],
        [3120, 2120, 4120]
      ),
      spacer(120),

      // ===== SECTION 3 =====
      h1("3. การติดตั้ง"),
      h2("3.1 ติดตั้ง qwen-cli"),
      para("รัน command ต่อไปนี้ใน terminal:"),
      code("python -m pip install -e D:\\qwen-cli"),
      spacer(80),
      h2("3.2 เพิ่ม PATH (ทำครั้งเดียว)"),
      para("เพื่อให้พิมพ์ qwen ได้โดยตรงโดยไม่ต้องระบุ path เต็ม รัน PowerShell:"),
      code('[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\\Users\\freshair\\AppData\\Local\\Programs\\Python\\Python313\\Scripts", "User")'),
      para("จากนั้นเปิด terminal ใหม่ 1 ครั้ง"),
      spacer(80),
      h2("3.3 ตรวจสอบการติดตั้ง"),
      code("qwen --list"),
      para("หากติดตั้งสำเร็จจะแสดงรายชื่อโมเดลทั้งหมดที่มีในเครื่อง"),
      spacer(120),

      // ===== SECTION 4 =====
      h1("4. คำสั่งพื้นฐาน"),
      h2("4.1 รูปแบบคำสั่ง"),
      code("qwen [options] \"prompt\""),
      spacer(80),
      h2("4.2 ตัวเลือก (Options) ทั้งหมด"),
      makeTable(
        ["Option", "ย่อ", "คำอธิบาย"],
        [
          ["--model <ชื่อ>", "-m", "ระบุโมเดลที่ต้องการใช้ (default: qwen2.5-coder:14b)"],
          ["--temp <ค่า>", "-t", "ระดับความสร้างสรรค์ 0.0-1.0 (default: 0.1)"],
          ["--code", "-c", "โหมดเขียนโค้ด: output โค้ดอย่างเดียว ไม่มีคำอธิบาย"],
          ["--review", "-r", "โหมด code review: วิเคราะห์และแนะนำเป็น bullet points"],
          ["--test", "", "โหมดเขียน unit test"],
          ["--doc", "-d", "โหมดเขียนเอกสาร markdown"],
          ["--no-stream", "", "ปิด streaming รอให้ได้ผลครบก่อนแสดง"],
          ["--system <text>", "-s", "กำหนด system prompt เอง"],
          ["--list", "-l", "แสดงโมเดลทั้งหมดที่มีในเครื่อง"],
        ],
        [2520, 720, 6120]
      ),
      spacer(120),

      // ===== SECTION 5 =====
      h1("5. ตัวอย่างการใช้งาน"),
      h2("5.1 ถามคำถามทั่วไป"),
      code('qwen "ฟังก์ชัน debounce คืออะไร"'),
      code('qwen "อธิบาย error: Cannot read properties of undefined"'),
      spacer(80),
      h2("5.2 เขียนโค้ด"),
      code('qwen --code "write a TypeScript function to validate email"'),
      code('qwen --code --model qwen2.5-coder:14b "create a Prisma query for user with posts"'),
      spacer(80),
      h2("5.3 Code Review"),
      code("type myfile.ts | qwen --review"),
      code('qwen --review "function foo(x) { return x*x }"'),
      spacer(80),
      h2("5.4 เขียน Unit Test"),
      code("type utils.ts | qwen --test"),
      code('qwen --test "write tests for a login function that checks email and password"'),
      spacer(80),
      h2("5.5 เขียนเอกสาร"),
      code("type api.ts | qwen --doc"),
      spacer(80),
      h2("5.6 ใช้โมเดลอื่น"),
      code('qwen --model llama3.2:1b "quick question: what is REST?"'),
      code('qwen --model qwen3:4b --code "write a React hook for debounce"'),
      spacer(80),
      h2("5.7 Custom System Prompt"),
      code('qwen --system "You are a Thai language teacher" "สอนการใช้ because vs because of"'),
      spacer(120),

      // ===== SECTION 6 =====
      h1("6. โมเดลที่มีในเครื่อง"),
      makeTable(
        ["ชื่อโมเดล", "ขนาด", "เหมาะสำหรับ"],
        [
          ["qwen2.5-coder:14b-instruct-q4_K_M", "9.0 GB", "เขียนโค้ด (default) — แนะนำ"],
          ["qwen3.5:9b-q4_K_M", "6.6 GB", "งานทั่วไป คิดเชิงลึก"],
          ["deepseek-coder-v2:lite", "8.9 GB", "เขียนโค้ด เชี่ยวชาญเป็นพิเศษ"],
          ["mistral-small:22b", "11.7 GB", "งานซับซ้อน ต้องการ context กว้าง"],
          ["qwen3:4b", "2.5 GB", "เร็ว เหมาะงานเบา"],
          ["llama3.2:1b", "1.3 GB", "เร็วมาก ตอบคำถามสั้น"],
          ["gemma3:1b", "0.8 GB", "เล็กที่สุด ทดสอบได้เร็ว"],
        ],
        [3600, 1200, 4560]
      ),
      spacer(120),

      // ===== SECTION 7 =====
      h1("7. การแก้ไขปัญหา"),
      h2("ERROR: Ollama not running"),
      para("Ollama ยังไม่ได้เปิด ให้เปิดโปรแกรม Ollama ก่อนแล้วรอจนขึ้น system tray icon จากนั้นรันคำสั่งใหม่"),
      spacer(80),
      h2("qwen ไม่พบ command"),
      para("PATH ยังไม่ได้เพิ่ม ให้รัน command ในข้อ 3.2 แล้วเปิด terminal ใหม่"),
      spacer(80),
      h2("โมเดลตอบช้ามาก"),
      para("ให้ลองเปลี่ยนเป็นโมเดลขนาดเล็กกว่า เช่น --model qwen3:4b หรือ --model llama3.2:1b"),
      spacer(120),

      // ===== SECTION 8 =====
      h1("8. ตำแหน่งไฟล์"),
      makeTable(
        ["ไฟล์", "ตำแหน่ง"],
        [
          ["สคริปต์หลัก", "D:\\qwen-cli\\qwen.py"],
          ["ไฟล์ติดตั้ง", "D:\\qwen-cli\\setup.py"],
          ["Command (exe)", "C:\\Users\\freshair\\AppData\\Local\\Programs\\Python\\Python313\\Scripts\\qwen.exe"],
        ],
        [2520, 6840]
      ),
      spacer(240),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 0 },
        children: [new TextRun({ text: "— จบคู่มือ —", color: "999999", size: 20, font: "Arial", italics: true })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("D:\\qwen-cli\\qwen_manual.docx", buffer);
  console.log("Done: D:\\qwen-cli\\qwen_manual.docx");
});
