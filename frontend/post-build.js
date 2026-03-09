import fs from "fs";
import path from "path";

const htmlPath = path.resolve(
  "../nextassist/public/nextassist/index.html"
);
const outPath = path.resolve("../nextassist/www/nextassist.html");

let html = fs.readFileSync(htmlPath, "utf-8");

// Inject Frappe boot context before closing </body>
const bootScript = `
  <script>window.csrf_token = '{{ csrf_token }}';
    if (!window.frappe) window.frappe = {};
    window.app_name = "{{ app_name }}";
    frappe.boot = JSON.parse({{ boot }});
  </script>`;

html = html.replace("</body>", `${bootScript}\n</body>`);

// Update <title> to use Jinja variable
html = html.replace("<title>NextAssist</title>", "<title>{{ app_name }}</title>");

fs.writeFileSync(outPath, html);
console.log("Post-build: Injected Frappe boot context into", outPath);
